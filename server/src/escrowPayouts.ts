import { prisma } from './db.ts';
import {
  escrowSignatureStatus,
  houseCanSettle,
  settleEscrowAsHouse,
} from './escrowOracle.ts';

const RECONCILE_INTERVAL_MS = 30_000;
const SUBMISSION_STALE_MS = 2 * 60_000;
const inFlight = new Set<string>();

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : 'escrow settlement failed').slice(0, 500);
}

export async function queueEscrowPayout(opts: {
  matchId: string;
  partyId: string;
  winnerAddress: string | null;
  house: boolean;
}): Promise<void> {
  await prisma.match.updateMany({
    where: { id: opts.matchId, escrowStatus: { not: 'confirmed' } },
    data: {
      escrowStatus: 'pending',
      escrowPartyId: opts.partyId,
      escrowWinnerAddress: opts.winnerAddress,
      escrowHouse: opts.house,
      escrowError: null,
    },
  });
  await processEscrowPayout(opts.matchId);
}

async function reconcileSubmitted(match: {
  id: string;
  escrowSignature: string | null;
  escrowSubmittedAt: Date | null;
}): Promise<boolean> {
  if (!match.escrowSignature) return false;
  const status = await escrowSignatureStatus(match.escrowSignature);
  if (status === 'confirmed') {
    await prisma.match.update({
      where: { id: match.id },
      data: {
        escrowStatus: 'confirmed',
        escrowSettledAt: new Date(),
        escrowError: null,
      },
    });
    return true;
  }
  if (status === 'pending') return true;
  const submittedAt = match.escrowSubmittedAt?.getTime() ?? 0;
  if (status === 'unknown' && Date.now() - submittedAt < SUBMISSION_STALE_MS) return true;
  await prisma.match.update({
    where: { id: match.id },
    data: {
      escrowStatus: 'pending',
      escrowSignature: null,
      escrowSubmittedAt: null,
      escrowError: status === 'failed' ? 'on-chain transaction failed' : 'submission expired before confirmation',
    },
  });
  return false;
}

export async function processEscrowPayout(matchId: string): Promise<void> {
  if (inFlight.has(matchId) || !houseCanSettle()) return;
  inFlight.add(matchId);
  try {
    let match = await prisma.match.findUnique({ where: { id: matchId } });
    if (
      !match ||
      match.escrowStatus === 'confirmed' ||
      match.escrowStatus === 'not_required' ||
      !match.escrowPartyId
    ) {
      return;
    }

    if (match.escrowStatus === 'submitted' && (await reconcileSubmitted(match))) return;
    match = await prisma.match.findUnique({ where: { id: matchId } });
    if (!match?.escrowPartyId || match.escrowStatus === 'confirmed') return;

    await prisma.match.update({
      where: { id: match.id },
      data: {
        escrowStatus: 'pending',
        escrowAttempts: { increment: 1 },
        escrowError: null,
      },
    });

    let submitted = false;
    try {
      const signature = await settleEscrowAsHouse({
        partyId: match.escrowPartyId,
        winnerAddress: match.escrowWinnerAddress,
        house: match.escrowHouse,
        onSubmitted: async (nextSignature) => {
          submitted = true;
          await prisma.match.update({
            where: { id: match.id },
            data: {
              escrowStatus: 'submitted',
              escrowSignature: nextSignature,
              escrowSubmittedAt: new Date(),
              escrowError: null,
            },
          });
        },
      });
      if (!signature) throw new Error('house settlement is unavailable');
      await prisma.match.update({
        where: { id: match.id },
        data: {
          escrowStatus: 'confirmed',
          escrowSignature: signature,
          escrowSettledAt: new Date(),
          escrowError: null,
        },
      });
    } catch (error) {
      await prisma.match.update({
        where: { id: match.id },
        data: {
          escrowStatus: submitted ? 'submitted' : 'failed',
          escrowError: errorMessage(error),
        },
      });
      console.error(`escrow payout ${match.id} pending retry:`, errorMessage(error));
    }
  } finally {
    inFlight.delete(matchId);
  }
}

async function reconcileEscrowPayouts(): Promise<void> {
  if (!houseCanSettle()) return;
  const matches = await prisma.match.findMany({
    where: { escrowStatus: { in: ['pending', 'submitted', 'failed'] } },
    select: { id: true },
    orderBy: { finishedAt: 'asc' },
    take: 20,
  });
  await Promise.all(matches.map(({ id }) => processEscrowPayout(id)));
}

export function startEscrowPayoutWorker(): void {
  void reconcileEscrowPayouts().catch((error) => console.error('escrow payout reconciliation failed', error));
  const timer = setInterval(() => {
    void reconcileEscrowPayouts().catch((error) => console.error('escrow payout reconciliation failed', error));
  }, RECONCILE_INTERVAL_MS);
  timer.unref();
}
