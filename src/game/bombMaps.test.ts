import { describe, expect, it } from 'vitest';
import { BOMB_MAPS, getBombMap } from './bombMaps';

const ARENA = { width: 900, height: 620 };

describe('Bomb Party maps', () => {
  it('selects maps deterministically from a seed', () => {
    expect(getBombMap(42, ARENA.width, ARENA.height).id).toBe(
      getBombMap(42, ARENA.width, ARENA.height).id,
    );
  });

  it('makes every map selectable', () => {
    const selected = new Set(
      BOMB_MAPS.map((_, seed) => getBombMap(seed, ARENA.width, ARENA.height).id),
    );
    expect(selected).toEqual(new Set(BOMB_MAPS.map((map) => map.id)));
  });

  it('keeps every hazard inside the arena', () => {
    for (let seed = 0; seed < BOMB_MAPS.length; seed += 1) {
      const map = getBombMap(seed, ARENA.width, ARENA.height);
      for (const hazard of map.hazards) {
        expect(hazard.x).toBeGreaterThanOrEqual(0);
        expect(hazard.y).toBeGreaterThanOrEqual(0);
        expect(hazard.x + hazard.w).toBeLessThanOrEqual(ARENA.width);
        expect(hazard.y + hazard.h).toBeLessThanOrEqual(ARENA.height);
      }
    }
  });

  it('keeps player spawn rings clear of solid blocks', () => {
    const playerRadius = 22;
    const spawnRadius = Math.min(ARENA.width, ARENA.height) * 0.34;
    for (let seed = 0; seed < BOMB_MAPS.length; seed += 1) {
      const blocks = getBombMap(seed, ARENA.width, ARENA.height).hazards.filter(
        (hazard) => hazard.kind === 'block',
      );
      for (let playerCount = 2; playerCount <= 20; playerCount += 1) {
        for (let index = 0; index < playerCount; index += 1) {
          const angle = (index / playerCount) * Math.PI * 2;
          const x = ARENA.width / 2 + Math.cos(angle) * spawnRadius;
          const y = ARENA.height / 2 + Math.sin(angle) * spawnRadius;
          for (const block of blocks) {
            const overlaps =
              x > block.x - playerRadius &&
              x < block.x + block.w + playerRadius &&
              y > block.y - playerRadius &&
              y < block.y + block.h + playerRadius;
            expect(overlaps, `${block.id} overlaps a ${playerCount}-player spawn`).toBe(false);
          }
        }
      }
    }
  });

  it('scales layouts for a different arena size', () => {
    const map = getBombMap(1, ARENA.width / 2, ARENA.height / 2);
    const source = BOMB_MAPS[1].hazards[0];
    expect(map.hazards[0]).toMatchObject({
      x: source.x / 2,
      y: source.y / 2,
      w: source.w / 2,
      h: source.h / 2,
    });
  });
});
