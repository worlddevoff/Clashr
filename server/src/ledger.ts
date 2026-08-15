import { prisma } from './db.ts';
import { simulatePrizePool } from '../../shared/tower/prize.ts';
import type { TowerMatchResult } from '../../shared/tower/types.ts';
import { applyXp } from './profile.ts';

const HOUSE = '__HOUSE__';

export async function ensureHouse(): Promise<void> {
  await prisma.user.upsert({
    where: { id: HOUSE },
    create: {
      id: HOUSE,
      username: 'CLASHR',
      avatar: '🏛️',
      color: '#22e5ff',
      account: { create: { balance: 10_000_000 } },
    },
    update: {},
  });
}

export async function getBalance(userId: string): Promise<number> {
  const acc = await prisma.creditAccount.findUnique({ where: { userId } });
  return acc?.balance ?? 0;
}

/** Debit entry fees when a ranked match actually starts so settle cannot race. */
export async function chargeMatchEntries(
  matchId: string,
  gameSlug: string,
  players: Array<{ id: string; username: string; avatar: string; color: string; isBot: boolean }>,
): Promise<void> {
  const pool = simulatePrizePool();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.match.findUnique({ where: { id: matchId } });
    if (existing) return;

    for (const p of players) {
      if (p.isBot) continue;
      const acc = await tx.creditAccount.findUnique({ where: { userId: p.id } });
      if (!acc || acc.balance < pool.entry) throw new Error('Insufficient demo credits');
    }

    await tx.match.create({
      data: {
        id: matchId,
        gameSlug,
        status: 'live',
        settled: false,
        gross: pool.gross,
        platformFee: pool.platformFee,
        prize: pool.prize,
      },
    });

    for (const p of players) {
      const payer = p.isBot ? HOUSE : p.id;
      await tx.creditAccount.update({
        where: { userId: payer },
        data: { balance: { decrement: pool.entry } },
      });
      await tx.ledgerEntry.create({
        data: {
          userId: payer,
          matchId,
          kind: 'entry',
          amount: -pool.entry,
          note: 'Tower match entry (virtual/demo credits)',
        },
      });
      await tx.matchParticipant.create({
        data: {
          matchId,
          userId: p.id,
          username: p.username,
          avatar: p.avatar,
          color: p.color,
          isBot: p.isBot,
        },
      });
    }
  });
}

export async function settleMatch(result: TowerMatchResult): Promise<void> {
  const existing = await prisma.match.findUnique({ where: { id: result.matchId } });
  if (existing?.settled) return;

  const pool = simulatePrizePool();
  await prisma.$transaction(async (tx) => {
    await tx.match.upsert({
      where: { id: result.matchId },
      create: {
        id: result.matchId,
        gameSlug: 'tower',
        seed: result.seed,
        status: 'finished',
        winnerId: result.winnerId,
        prize: pool.prize,
        gross: pool.gross,
        platformFee: pool.platformFee,
        settled: true,
        finishedAt: new Date(),
      },
      update: {
        status: 'finished',
        winnerId: result.winnerId,
        prize: pool.prize,
        gross: pool.gross,
        platformFee: pool.platformFee,
        settled: true,
        finishedAt: new Date(),
      },
    });

    const alreadyCharged = await tx.ledgerEntry.findFirst({
      where: { matchId: result.matchId, kind: 'entry' },
    });

    for (const p of result.participants) {
      const payer = p.isBot ? HOUSE : p.id;
      if (!alreadyCharged) {
        if (!p.isBot) {
          const acc = await tx.creditAccount.findUnique({ where: { userId: p.id } });
          if (!acc || acc.balance < pool.entry) throw new Error('Insufficient demo credits');
        }
        await tx.creditAccount.update({
          where: { userId: payer },
          data: { balance: { decrement: pool.entry } },
        });
        await tx.ledgerEntry.create({
          data: {
            userId: payer,
            matchId: result.matchId,
            kind: 'entry',
            amount: -pool.entry,
            note: 'Tower match entry (virtual/demo credits)',
          },
        });
      }

      await tx.matchParticipant.upsert({
        where: { matchId_userId: { matchId: result.matchId, userId: p.id } },
        create: {
          matchId: result.matchId,
          userId: p.id,
          username: p.username,
          avatar: p.avatar,
          color: p.color,
          isBot: p.isBot,
          placement: p.placement,
          floorsReached: p.floorsReached,
          shoves: p.shoves,
          fallsSurvived: p.fallsSurvived,
          creditsWon: p.creditsWon,
        },
        update: {
          placement: p.placement,
          floorsReached: p.floorsReached,
          shoves: p.shoves,
          fallsSurvived: p.fallsSurvived,
          creditsWon: p.creditsWon,
        },
      });
    }

    await tx.ledgerEntry.create({
      data: {
        userId: HOUSE,
        matchId: result.matchId,
        kind: 'platform_fee',
        amount: pool.platformFee,
        note: 'Simulated 5% platform revenue (virtual/demo)',
      },
    });
    await tx.creditAccount.update({
      where: { userId: HOUSE },
      data: { balance: { increment: pool.platformFee } },
    });

    const winner = result.participants.find((p) => p.id === result.winnerId);
    const winnerAcct = winner?.isBot ? HOUSE : result.winnerId;
    await tx.creditAccount.update({
      where: { userId: winnerAcct },
      data: { balance: { increment: pool.prize } },
    });
    await tx.ledgerEntry.create({
      data: {
        userId: winnerAcct,
        matchId: result.matchId,
        kind: 'prize',
        amount: pool.prize,
        note: 'Tower prize (virtual/demo credits)',
      },
    });

    for (const e of result.timeline) {
      await tx.replayEvent.create({
        data: {
          matchId: result.matchId,
          t: e.t,
          kind: e.kind,
          payload: e as object,
        },
      });
    }
    for (const m of result.moments) {
      await tx.detectedMoment.create({
        data: {
          matchId: result.matchId,
          kind: m.kind,
          headline: m.headline,
          player: m.player,
          avatar: m.avatar,
          color: m.color,
          stat: m.stat,
        },
      });
    }

    if (winner && !winner.isBot) {
      const row = await tx.leaderboardRow.findUnique({ where: { userId: winner.id } });
      await tx.leaderboardRow.upsert({
        where: { userId: winner.id },
        create: {
          userId: winner.id,
          username: winner.username,
          avatar: winner.avatar,
          color: winner.color,
          wins: 1,
          gamesPlayed: 1,
          biggestWin: pool.prize,
          streak: 1,
        },
        update: {
          wins: { increment: 1 },
          gamesPlayed: { increment: 1 },
          biggestWin: Math.max(row?.biggestWin ?? 0, pool.prize),
          streak: { increment: 1 },
          username: winner.username,
        },
      });
    }

    for (const p of result.participants) {
      if (p.isBot || p.id === result.winnerId) continue;
      await tx.leaderboardRow.upsert({
        where: { userId: p.id },
        create: {
          userId: p.id,
          username: p.username,
          avatar: p.avatar,
          color: p.color,
          wins: 0,
          gamesPlayed: 1,
          biggestWin: 0,
          streak: 0,
        },
        update: { gamesPlayed: { increment: 1 }, streak: 0 },
      });
    }
  });

  for (const p of result.participants) {
    if (p.isBot) continue;
    await applyXp(p.id, p.id === result.winnerId ? 250 : 80);
  }
}

export async function settleBombMatch(opts: {
  matchId: string;
  winnerId: string | null;
  practice: boolean;
  prize: number;
  players: Array<{ id: string; username: string; avatar: string; color: string; isBot: boolean }>;
}): Promise<void> {
  const existing = await prisma.match.findUnique({ where: { id: opts.matchId } });
  if (existing?.settled) return;
  const prizeLamports = opts.practice ? 0 : Math.max(0, Math.round(opts.prize * 1e9));
  await prisma.match.upsert({
    where: { id: opts.matchId },
    create: {
      id: opts.matchId,
      gameSlug: 'bomb-party',
      status: 'finished',
      practice: opts.practice,
      winnerId: opts.winnerId,
      prize: prizeLamports,
      settled: true,
      finishedAt: new Date(),
    },
    update: {
      status: 'finished',
      practice: opts.practice,
      winnerId: opts.winnerId,
      prize: prizeLamports,
      settled: true,
      finishedAt: new Date(),
    },
  });
  const { recordSelfResult } = await import('./parties.ts');
  for (const p of opts.players) {
    if (p.isBot) continue;
    await recordSelfResult({
      userId: p.id,
      username: p.username,
      avatar: p.avatar,
      color: p.color,
      won: p.id === opts.winnerId,
      prize: p.id === opts.winnerId ? prizeLamports : 0,
      practice: opts.practice,
    });
  }
}
