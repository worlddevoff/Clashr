// Assembles a Bomb Party session: seeds the roster (humans + bots), computes the
// prize pool via the PrizePoolProvider, and builds the fairness/result record
// on completion. Keeps game/economy logic out of React components.
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BOT_NAMES, AVATARS, NEON_COLORS, randomFrom, botDisplayName } from '../data/avatars';
import type { BombPartySeedPlayer } from './BombPartyEngine';
import type { GameResult } from '../types/domain';
import type { PartyGameRoster, PartyMember } from '../types/party';
import { computeEscrowPool } from '../lib/escrow';

export interface SessionSetup {
  capacity: number;
  entry: number;
  seed: BombPartySeedPlayer[];
  humanId: string;
  /** Net prize after platform fee — 0 in solo/practice (vs bots only). */
  prizePool: number;
  platformFee: number;
  grossPool: number;
  /** True when only one human is in the match — no SOL prize. */
  practiceMode: boolean;
  humanCount: number;
  gameNumber: number;
  prizeCurrency: 'SOL';
  escrowPda?: string;
}

function fillBots(count: number, usedNames: Set<string>): BombPartySeedPlayer[] {
  const bots: BombPartySeedPlayer[] = [];
  for (let i = 0; i < count; i++) {
    let base = randomFrom(BOT_NAMES);
    let guard = 0;
    while (usedNames.has(base) && guard++ < 40) {
      base = `${randomFrom(BOT_NAMES)}${guard > 20 ? guard : ''}`;
    }
    usedNames.add(base);
    bots.push({
      id: `bot:${base.toLowerCase()}`,
      username: botDisplayName(base),
      avatar: randomFrom(AVATARS),
      color: randomFrom(NEON_COLORS),
      isHuman: false,
    });
  }
  return bots;
}

export function useGameSetup(
  capacity: number,
  entry: number,
  partyMembers?: PartyMember[] | null,
  roster?: PartyGameRoster | null,
): SessionSetup {
  const { user } = useAuth();

  return useMemo(() => {
    const humanId = user?.id ?? 'human';
    const usedNames = new Set<string>();
    let humans: BombPartySeedPlayer[];
    const members = roster?.members ?? partyMembers;

    if (members && members.length > 0) {
      humans = members.map((m) => {
        usedNames.add(m.username);
        return {
          id: m.id,
          username: m.username,
          avatar: m.avatar,
          color: m.color,
          isHuman: true,
        };
      });
      // Ensure local user is present even if roster lagged
      if (!humans.some((h) => h.id === humanId) && user) {
        humans.push({
          id: humanId,
          username: user.username,
          avatar: user.avatar,
          color: user.color,
          isHuman: true,
        });
      }
    } else {
      humans = [
        {
          id: humanId,
          username: user?.username ?? 'You',
          avatar: user?.avatar ?? '🐸',
          color: user?.color ?? '#22e5ff',
          isHuman: true,
        },
      ];
      usedNames.add(humans[0].username);
    }

    const botsNeeded = Math.max(0, capacity - humans.length);
    const bots = fillBots(botsNeeded, usedNames);
    const seed = [...humans, ...bots];
    const humanCount = humans.length;
    // Solo / bots-only fillers: no SOL prize.
    // Real multi-human pots: winner gets (entry × humans) − platform fee.
    const practiceMode = humanCount < 2;
    const escrow = !!roster?.escrowPda;
    const pool = escrow
      ? computeEscrowPool(humanCount, roster?.entryLamports)
      : { gross: 0, platformFee: 0, prizePool: 0 };
    return {
      capacity,
      entry,
      seed,
      humanId,
      prizePool: pool.prizePool,
      platformFee: pool.platformFee,
      grossPool: pool.gross,
      practiceMode,
      humanCount,
      gameNumber: 400 + Math.floor(Math.random() * 200),
      prizeCurrency: 'SOL',
      escrowPda: roster?.escrowPda,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capacity, entry, partyMembers, roster]);
}

export function buildResult(
  setup: SessionSetup,
  winnerId: string | null,
  survivedSec: number,
  seedHashFn: (s: string) => string,
  serverSeedFn: () => string,
): GameResult {
  const winner = setup.seed.find((p) => p.id === winnerId) ?? setup.seed[0];
  const serverSeed = serverSeedFn();
  return {
    gameId: `bp_${setup.gameNumber}_${Date.now().toString(36)}`,
    gameNumber: setup.gameNumber,
    winner: winner.username,
    winnerId: winner.id,
    winnerAvatar: winner.avatar,
    winnerColor: winner.color,
    winnerIsBot: !winner.isHuman,
    prize: setup.prizePool,
    prizeCurrency: setup.prizeCurrency,
    grossPool: setup.grossPool,
    platformFee: setup.platformFee,
    practiceMode: setup.practiceMode,
    survivedSec,
    playerCount: setup.seed.length,
    serverSeedHash: seedHashFn(serverSeed),
    timestamp: Date.now(),
    players: setup.seed.map((p) => p.username),
  };
}
