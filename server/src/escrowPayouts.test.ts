import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const match = {
    id: 'match-1',
    escrowStatus: 'not_required',
    escrowPartyId: null as string | null,
    escrowWinnerAddress: null as string | null,
    escrowHouse: false,
    escrowSignature: null as string | null,
    escrowAttempts: 0,
    escrowError: null as string | null,
    escrowSubmittedAt: null as Date | null,
    escrowSettledAt: null as Date | null,
  };
  const apply = (data: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'increment' in value) {
        (match as Record<string, unknown>)[key] =
          Number((match as Record<string, unknown>)[key] ?? 0) +
          Number((value as { increment: number }).increment);
      } else {
        (match as Record<string, unknown>)[key] = value;
      }
    }
  };
  return {
    match,
    apply,
    settle: vi.fn(),
    signatureStatus: vi.fn(),
  };
});

vi.mock('./db.ts', () => ({
  prisma: {
    match: {
      updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        mocks.apply(data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        mocks.apply(data);
        return { ...mocks.match };
      }),
      findUnique: vi.fn(async () => ({ ...mocks.match })),
      findMany: vi.fn(async () => []),
    },
  },
}));

vi.mock('./escrowOracle.ts', () => ({
  houseCanSettle: () => true,
  settleEscrowAsHouse: mocks.settle,
  escrowSignatureStatus: mocks.signatureStatus,
}));

import { processEscrowPayout, queueEscrowPayout } from './escrowPayouts.ts';

beforeEach(() => {
  Object.assign(mocks.match, {
    escrowStatus: 'not_required',
    escrowPartyId: null,
    escrowWinnerAddress: null,
    escrowHouse: false,
    escrowSignature: null,
    escrowAttempts: 0,
    escrowError: null,
    escrowSubmittedAt: null,
    escrowSettledAt: null,
  });
  mocks.settle.mockReset();
  mocks.signatureStatus.mockReset();
});

describe('escrow payout reconciliation', () => {
  it('persists the recipient and confirms the submitted signature', async () => {
    mocks.settle.mockImplementation(async (opts: { onSubmitted?: (signature: string) => Promise<void> }) => {
      await opts.onSubmitted?.('signature-1');
      return 'signature-1';
    });

    await queueEscrowPayout({
      matchId: 'match-1',
      partyId: 'PARTY1',
      winnerAddress: 'winner-wallet',
      house: false,
    });

    expect(mocks.match).toMatchObject({
      escrowStatus: 'confirmed',
      escrowPartyId: 'PARTY1',
      escrowWinnerAddress: 'winner-wallet',
      escrowSignature: 'signature-1',
      escrowAttempts: 1,
    });
  });

  it('reconciles a submitted transaction after confirmation was interrupted', async () => {
    mocks.settle.mockImplementation(async (opts: { onSubmitted?: (signature: string) => Promise<void> }) => {
      await opts.onSubmitted?.('signature-2');
      throw new Error('confirmation timed out');
    });

    await queueEscrowPayout({
      matchId: 'match-1',
      partyId: 'PARTY1',
      winnerAddress: 'winner-wallet',
      house: false,
    });
    expect(mocks.match.escrowStatus).toBe('submitted');

    mocks.signatureStatus.mockResolvedValue('confirmed');
    await processEscrowPayout('match-1');

    expect(mocks.match.escrowStatus).toBe('confirmed');
    expect(mocks.settle).toHaveBeenCalledTimes(1);
  });
});
