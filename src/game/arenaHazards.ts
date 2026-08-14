import type { ArenaHazard } from '../types/game';

/** Procedural mid-arena props: solid blocks + ice patches. */
export function buildArenaHazards(width: number, height: number): ArenaHazard[] {
  const cx = width / 2;
  const cy = height / 2;
  return [
    { id: 'b1', kind: 'block', x: cx - 160, y: cy - 40, w: 70, h: 70 },
    { id: 'b2', kind: 'block', x: cx + 90, y: cy - 40, w: 70, h: 70 },
    { id: 'b3', kind: 'block', x: cx - 35, y: cy + 110, w: 70, h: 56 },
    { id: 'i1', kind: 'ice', x: 80, y: 80, w: 140, h: 90 },
    { id: 'i2', kind: 'ice', x: width - 220, y: height - 170, w: 140, h: 90 },
    { id: 'i3', kind: 'ice', x: cx - 70, y: 70, w: 140, h: 70 },
  ];
}
