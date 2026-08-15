import { describe, expect, it } from 'vitest';
import {
  BombPartyEngine,
  computeSafeZone,
  ZONE_CLOSE_MS,
  ZONE_GRACE_MS,
  ZONE_MIN_FRACTION,
  type BombPartySeedPlayer,
} from './BombPartyEngine';

const ARENA = { width: 900, height: 620 };
const CENTER = { x: ARENA.width / 2, y: ARENA.height / 2 };

function seed(n = 4): BombPartySeedPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i === 0 ? 'human' : `bot-${i}`,
    username: i === 0 ? 'You' : `Bot ${i}`,
    avatar: '🐸',
    color: '#22e5ff',
    isHuman: i === 0,
  }));
}

function makeEngine(players = 4, startTimer = 8) {
  return new BombPartyEngine(seed(players), {
    arena: ARENA,
    startTimer,
    passTimeBonus: 0,
    humanId: 'human',
    countdownMs: 0,
  });
}

function inside(p: { x: number; y: number }, z: { x: number; y: number; w: number; h: number }, pad = 0) {
  return p.x >= z.x - pad && p.x <= z.x + z.w + pad && p.y >= z.y - pad && p.y <= z.y + z.h + pad;
}

describe('Bomb Party storm', () => {
  it('stays lethal after the zone finishes shrinking', () => {
    const zone = computeSafeZone(ZONE_GRACE_MS + ZONE_CLOSE_MS + 200, 'live', ARENA);
    expect(zone.w).toBeCloseTo(ARENA.width * ZONE_MIN_FRACTION, 5);
    expect(zone.h).toBeCloseTo(ARENA.height * ZONE_MIN_FRACTION, 5);
    expect(zone.closing).toBe(false);
    expect(zone.storm).toBe(true);
  });

  it('is not lethal during the opening grace period', () => {
    const zone = computeSafeZone(ZONE_GRACE_MS - 1, 'live', ARENA);
    expect(zone.storm).toBe(false);
    expect(zone.w).toBe(ARENA.width);
  });

  it('does not let a player keep playing in the darkened ring', () => {
    const engine = makeEngine(3, 999);
    engine.debugSetElapsed(ZONE_GRACE_MS + ZONE_CLOSE_MS + 200);
    for (const p of engine.snapshot().players) {
      engine.debugSetPos(p.id, CENTER.x, CENTER.y);
    }
    const zone = engine.snapshot().safeZone;
    expect(zone.storm).toBe(true);
    expect(zone.closing).toBe(false);

    engine.setLocalMoveTarget({ x: 20, y: 20 });
    for (let i = 0; i < 60; i++) engine.step(50);

    const human = engine.snapshot().players.find((p) => p.id === 'human')!;
    expect(human.alive).toBe(true);
    expect(inside(human.pos, zone, 1)).toBe(true);
  });
});

describe('Bomb Party fuse', () => {
  it('opens shorter than the old 10-second hold', () => {
    const engine = makeEngine();
    expect(engine.snapshot().bomb?.timeLeft).toBeLessThanOrEqual(8);
    expect(engine.snapshot().bomb?.timeLeft).toBeGreaterThan(7);
  });

  it('hands the next holder a tighter fuse in a closed arena', () => {
    const engine = makeEngine(4, 8);
    engine.debugSetElapsed(ZONE_GRACE_MS + ZONE_CLOSE_MS);
    expect(engine.getHoldSeconds()).toBeLessThanOrEqual(5.5);
    expect(engine.getHoldSeconds()).toBeGreaterThanOrEqual(4.5);
  });
});

describe('Bomb Party forfeit', () => {
  it('eliminates a player and ends the match if one remains', () => {
    const engine = makeEngine(2);
    engine.forfeit('human');
    expect(engine.snapshot().players.find((p) => p.id === 'human')?.alive).toBe(false);
    expect(engine.finished()).toBe(true);
    expect(engine.winnerId()).toBe('bot-1');
  });
});
