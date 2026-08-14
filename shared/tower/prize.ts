import {
  TOWER_ENTRY_CREDITS,
  TOWER_MATCH_SIZE,
  TOWER_PLATFORM_FEE_BPS,
} from '../games';

export interface PrizePoolBreakdown {
  entry: number;
  players: number;
  gross: number;
  feeBps: number;
  platformFee: number;
  prize: number;
  disclaimer: string;
}

export function simulatePrizePool(
  players = TOWER_MATCH_SIZE,
  entry = TOWER_ENTRY_CREDITS,
): PrizePoolBreakdown {
  const gross = players * entry;
  const platformFee = Math.round((gross * TOWER_PLATFORM_FEE_BPS) / 10_000);
  const prize = gross - platformFee;
  return {
    entry,
    players,
    gross,
    feeBps: TOWER_PLATFORM_FEE_BPS,
    platformFee,
    prize,
    disclaimer: 'VIRTUAL / DEMO CREDITS — NO REAL-WORLD VALUE',
  };
}
