import { describe, expect, it } from 'vitest';
import { simulatePrizePool } from '../../shared/tower/prize';

describe('ledger math', () => {
  it('entries, fee, and prize sum to the gross pool', () => {
    const p = simulatePrizePool(10, 100);
    expect(p.players * p.entry).toBe(p.gross);
    expect(p.platformFee + p.prize).toBe(p.gross);
    expect(p.platformFee).toBe(50);
  });
});
