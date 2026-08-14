import {
  FLOOR_COUNT,
  FLOOR_HEIGHT,
  FLOOR_STEP_GAP,
  GRAVITY,
  FALL_GRAVITY_MULT,
  JUMP_SPEED,
  MAX_JUMP_HEIGHT,
  MODULE_BY_BAND,
  MOVE_SPEED,
  BANDS,
  type ModuleKind,
} from './constants';
import { createRng, pick, randRange } from './rng';
import type { TowerBlueprint, TowerPlatform } from './types';

function floorY(floor: number): number {
  return (floor - 1) * FLOOR_HEIGHT;
}

function bandFor(floor: number): string {
  const b = BANDS.find((x) => floor >= x.from && floor <= x.to);
  return b?.label ?? 'endgame';
}

function kindForFloor(floor: number, rng: () => number): ModuleKind {
  if (floor === 1) return 'tutorial_wide';
  if (floor >= FLOOR_COUNT) return 'final_climb';
  const kinds = MODULE_BY_BAND[bandFor(floor)] ?? MODULE_BY_BAND.endgame;
  if (floor >= 26 && rng() > 0.35) return 'final_climb';
  return pick(rng, kinds);
}

function plat(
  id: string,
  floor: number,
  kind: ModuleKind,
  x: number,
  z: number,
  sx: number,
  sz: number,
  extra: Partial<TowerPlatform> = {},
): TowerPlatform {
  return {
    id,
    floor,
    kind,
    x,
    y: floorY(floor),
    z,
    sx,
    sy: 0.45,
    sz,
    rotY: 0,
    ...extra,
  };
}

function buildModule(
  floor: number,
  kind: ModuleKind,
  rng: () => number,
  idBase: string,
): TowerPlatform[] {
  const y = floorY(floor);
  const out: TowerPlatform[] = [];
  const id = (n: number) => `${idBase}-${n}`;

  switch (kind) {
    case 'tutorial_wide': {
      out.push(plat(id(0), floor, kind, 0, 0, 12, 12));
      out.push(plat(id(1), floor, kind, 4.2, 0, 3.2, 3.2, { y: y + 1.6 }));
      out.push(plat(id(2), floor, kind, -3.6, 2.4, 3.4, 3.4, { y: y + 3.1 }));
      break;
    }
    case 'bounce': {
      out.push(plat(id(0), floor, kind, 0, 0, 6, 6));
      out.push(plat(id(1), floor, kind, 3.5, -2, 2.4, 2.4, { bounce: 16, y: y + 0.2 }));
      out.push(plat(id(2), floor, kind, -3.8, 2.2, 2.4, 2.4, { bounce: 16, y: y + 0.2 }));
      out.push(plat(id(3), floor, kind, 0, 4.5, 2.8, 2.2, { y: y + 2.8, isSafety: true }));
      break;
    }
    case 'bridge': {
      out.push(plat(id(0), floor, kind, -5.2, 0, 3.2, 3.2));
      out.push(plat(id(1), floor, kind, 0, 0, 6.8, 1.15));
      out.push(plat(id(2), floor, kind, 5.2, 0, 3.2, 3.2));
      out.push(plat(id(3), floor, kind, 0, 3.8, 2.4, 2.2, { isSafety: true, y: y - 2.4 }));
      break;
    }
    case 'rotating': {
      out.push(
        plat(id(0), floor, kind, 3.6, 0, 4.4, 2.2, {
          motion: { type: 'orbit', radius: 3.6, speed: 0.55 + rng() * 0.25, height: y },
        }),
      );
      out.push(
        plat(id(1), floor, kind, -3.6, 0, 4.4, 2.2, {
          motion: { type: 'orbit', radius: 3.6, speed: -(0.5 + rng() * 0.2), height: y },
        }),
      );
      out.push(plat(id(2), floor, kind, 0, 0, 2.4, 2.4));
      break;
    }
    case 'hammer': {
      out.push(plat(id(0), floor, kind, 0, 0, 8.5, 3.4));
      out.push(
        plat(id(1), floor, kind, 0, 0, 0.7, 6.5, {
          y: y + 1.4,
          sy: 1.4,
          motion: { type: 'hammer', speed: 1.1 + rng() * 0.4, length: 6.5 },
        }),
      );
      break;
    }
    case 'movers': {
      out.push(plat(id(0), floor, kind, -5, 0, 3, 3));
      out.push(
        plat(id(1), floor, kind, 0, 0, 2.6, 2.2, {
          motion: { type: 'slide', axis: 'x', amp: 4.2, speed: 0.9 },
        }),
      );
      out.push(
        plat(id(2), floor, kind, 0, 3, 2.4, 2.2, {
          y: y + 1.8,
          motion: { type: 'slide', axis: 'z', amp: 2.4, speed: 0.7 },
        }),
      );
      out.push(plat(id(3), floor, kind, 5.2, 0, 3, 3, { y: y + 2.4 }));
      break;
    }
    case 'collapse': {
      out.push(plat(id(0), floor, kind, -2.4, 0, 3.6, 3.6, { collapseAfter: 2.4 + rng() }));
      out.push(plat(id(1), floor, kind, 2.6, 1.2, 3.4, 3.4, { collapseAfter: 3.2 + rng() }));
      out.push(plat(id(2), floor, kind, 0, -3.4, 3, 2.4, { collapseAfter: 4 + rng() }));
      out.push(plat(id(3), floor, kind, 0, 4.6, 2.6, 2, { isSafety: true, y: y - 2.2 }));
      break;
    }
    case 'conveyor': {
      out.push(plat(id(0), floor, kind, 0, 0, 9, 3.2, { conveyor: -5.5 }));
      out.push(plat(id(1), floor, kind, 0, 4.2, 3.5, 2.4, { y: y + 2.2 }));
      break;
    }
    case 'spinning_beam': {
      out.push(plat(id(0), floor, kind, 0, 0, 7.5, 7.5));
      out.push(
        plat(id(1), floor, kind, 0, 0, 10, 0.7, {
          y: y + 1.1,
          sy: 1.1,
          motion: { type: 'beam', speed: 1.35, length: 10 },
        }),
      );
      break;
    }
    case 'wall_jump': {
      out.push(plat(id(0), floor, kind, -4.6, 0, 2.4, 4));
      out.push(plat(id(1), floor, kind, 4.6, 0, 2.4, 4, { y: y + 2.8 }));
      out.push(
        plat(id(2), floor, kind, -2.2, 0, 0.45, 4.2, {
          y: y + 2.4,
          sy: 4.2,
          climbable: true,
        }),
      );
      out.push(
        plat(id(3), floor, kind, 2.2, 0, 0.45, 4.2, {
          y: y + 2.4,
          sy: 4.2,
          climbable: true,
        }),
      );
      break;
    }
    case 'elevator': {
      out.push(plat(id(0), floor, kind, -4, 0, 3.2, 3.2));
      out.push(
        plat(id(1), floor, kind, 0.4, 0, 3.1, 3.1, {
          motion: { type: 'elevate', amp: 3.4, speed: 0.85 },
        }),
      );
      out.push(plat(id(2), floor, kind, 4.6, 0, 2.8, 2.8, { y: y + 3.4 }));
      break;
    }
    case 'fake_shortcut': {
      out.push(plat(id(0), floor, kind, -3.5, 0, 4, 4));
      out.push(
        plat(id(1), floor, kind, 3.4, 0, 2.8, 2.2, {
          y: y + 2.6,
          fake: true,
          collapseAfter: 0.7,
        }),
      );
      out.push(plat(id(2), floor, kind, 3.4, 3.6, 3, 2.4, { y: y + 3.2 }));
      break;
    }
    case 'trap_lane': {
      out.push(plat(id(0), floor, kind, 0, -3.2, 8, 2.2));
      out.push(
        plat(id(1), floor, kind, 0, 0, 8, 0.8, {
          y: y + 1.2,
          sy: 1.2,
          motion: { type: 'beam', speed: 1.7, length: 8 },
        }),
      );
      out.push(plat(id(2), floor, kind, 0, 3.4, 4.5, 2.6, { y: y + 2.2 }));
      break;
    }
    case 'choke': {
      out.push(plat(id(0), floor, kind, 0, 0, 3.1, 3.1));
      out.push(plat(id(1), floor, kind, 0, 0, 2.2, 8.4, { rotY: randRange(rng, 0, 0.4) }));
      out.push(plat(id(2), floor, kind, 3.8, 3.2, 2.4, 2.4, { y: y + 1.8 }));
      break;
    }
    case 'final_climb': {
      out.push(plat(id(0), floor, kind, 0, 0, 4.6, 4.6));
      out.push(plat(id(1), floor, kind, 2.8, -2.4, 2.2, 2.2, { y: y + 1.7 }));
      out.push(plat(id(2), floor, kind, -2.6, 2.2, 2.2, 2.2, { y: y + 3.2 }));
      if (floor >= FLOOR_COUNT) {
        out.push(
          plat(id(9), floor, kind, 0, 0, 3.4, 3.4, {
            y: y + 4.6,
            isWin: true,
            sy: 0.55,
          }),
        );
      }
      break;
    }
    default:
      out.push(plat(id(0), floor, kind, 0, 0, 7, 7));
  }

  return out;
}

/** Hazards sweep through space; you cannot stand on them. */
function isHazard(p: TowerPlatform): boolean {
  return p.motion?.type === 'hammer' || p.motion?.type === 'beam';
}

function isStandable(p: TowerPlatform): boolean {
  return !isHazard(p) && !p.fake && !p.climbable;
}

function topOf(p: TowerPlatform): number {
  return p.y + p.sy / 2;
}

/**
 * How far a player can travel horizontally in a single jump that ends `dy`
 * above the takeoff point. Scaled down so the generator leaves real margin.
 */
export function jumpReach(dy: number): number {
  if (dy > MAX_JUMP_HEIGHT) return 0;
  const up = JUMP_SPEED / GRAVITY;
  const down = Math.sqrt((2 * Math.max(0, MAX_JUMP_HEIGHT - dy)) / (GRAVITY * FALL_GRAVITY_MULT));
  return MOVE_SPEED * (up + down) * 0.7;
}

/** Gap between two platform footprints, 0 when they overlap in plan view. */
function footprintGap(a: TowerPlatform, b: TowerPlatform): number {
  const dx = Math.max(0, Math.abs(a.x - b.x) - (a.sx + b.sx) / 2);
  const dz = Math.max(0, Math.abs(a.z - b.z) - (a.sz + b.sz) / 2);
  return Math.hypot(dx, dz);
}

function canJump(from: TowerPlatform, to: TowerPlatform): boolean {
  const dy = topOf(to) - topOf(from);
  if (dy > MAX_JUMP_HEIGHT) return false;
  return footprintGap(from, to) <= jumpReach(dy);
}

/** Ids of every standable platform a player can get to from the spawn floor. */
function reachableSet(platforms: TowerPlatform[]): Set<string> {
  const nodes = platforms.filter(isStandable);
  const frontier = nodes.filter((p) => p.floor === 1);
  const seen = new Set(frontier.map((p) => p.id));
  while (frontier.length) {
    const from = frontier.pop()!;
    for (const to of nodes) {
      if (seen.has(to.id)) continue;
      const boosted =
        from.bounce != null &&
        topOf(to) - topOf(from) <= (from.bounce * from.bounce) / (2 * GRAVITY);
      if (!boosted && !canJump(from, to)) continue;
      seen.add(to.id);
      frontier.push(to);
    }
  }
  return seen;
}

/** How many stepping stones it would take to link two platforms. */
function stepsBetween(from: TowerPlatform, to: TowerPlatform): number {
  const rise = topOf(to) - topOf(from);
  const span = Math.hypot(to.x - from.x, to.z - from.z);
  let count = Math.max(1, Math.ceil(rise / FLOOR_STEP_GAP));
  while (count < 10 && (rise / count > FLOOR_STEP_GAP || span / count - 2.3 > jumpReach(rise / count))) {
    count += 1;
  }
  return count - 1;
}

function linkWithSteps(
  platforms: TowerPlatform[],
  from: TowerPlatform,
  to: TowerPlatform,
  tag: string,
): void {
  const count = stepsBetween(from, to) + 1;
  const rise = topOf(to) - topOf(from);
  const hazardReach = platforms
    .filter((p) => isHazard(p) && Math.abs(p.y - (from.y + to.y) / 2) < FLOOR_HEIGHT)
    .reduce((m, p) => Math.max(m, Math.max(p.sx, p.sz) / 2), 0);

  for (let i = 1; i < count; i++) {
    const t = i / count;
    let x = from.x + (to.x - from.x) * t;
    let z = from.z + (to.z - from.z) * t;
    const y = topOf(from) + rise * t;

    // Keep clear of the central column and of anything sweeping this floor.
    const minR = Math.max(2.6, hazardReach + 1.4);
    const r = Math.hypot(x, z);
    if (r < minR) {
      const a = r > 0.01 ? Math.atan2(x, z) : (i / count) * Math.PI * 2;
      x = Math.sin(a) * minR;
      z = Math.cos(a) * minR;
    }

    platforms.push({
      id: `${tag}-${i}`,
      floor: to.floor,
      kind: 'tutorial_wide',
      x,
      y: y - 0.225,
      z,
      sx: 2.3,
      sy: 0.45,
      sz: 2.3,
      rotY: 0,
      isStep: true,
    });
  }
}

/**
 * Modules are authored per floor with no guarantee that anything above is in
 * jump range — most transitions need 2.5–5.6 units of lift, which no jump
 * covers. Repeatedly find the lowest floor a player cannot reach and bridge to
 * it with stepping stones until the whole tower, including the win pad, is
 * climbable.
 */
function ensureClimbable(platforms: TowerPlatform[]): void {
  for (let guard = 0; guard < FLOOR_COUNT * 3; guard++) {
    const reachable = reachableSet(platforms);
    const standable = platforms.filter(isStandable);

    let targets: TowerPlatform[] | null = null;
    for (let floor = 2; floor <= FLOOR_COUNT; floor++) {
      const cands = standable.filter((p) => p.floor === floor);
      if (!cands.length || cands.some((p) => reachable.has(p.id))) continue;
      targets = cands;
      break;
    }
    if (!targets) {
      const win = platforms.find((p) => p.isWin);
      if (!win || reachable.has(win.id)) return;
      targets = [win];
    }

    let bestFrom: TowerPlatform | null = null;
    let bestTo: TowerPlatform | null = null;
    let bestCost = Infinity;
    for (const to of targets) {
      for (const from of standable) {
        if (!reachable.has(from.id)) continue;
        if (topOf(from) > topOf(to)) continue;
        const cost = stepsBetween(from, to) * 10 + Math.hypot(to.x - from.x, to.z - from.z);
        if (cost < bestCost) {
          bestCost = cost;
          bestFrom = from;
          bestTo = to;
        }
      }
    }
    if (!bestFrom || !bestTo) return;
    linkWithSteps(platforms, bestFrom, bestTo, `${bestFrom.id}~${bestTo.id}`);
  }
}

export function generateTower(seed: number): TowerBlueprint {
  const rng = createRng(seed);
  const platforms: TowerPlatform[] = [];
  const used = new Set<ModuleKind>();

  for (let floor = 1; floor <= FLOOR_COUNT; floor++) {
    let kind = kindForFloor(floor, rng);
    if (floor > 1 && floor < FLOOR_COUNT && used.has(kind) && rng() > 0.4) {
      kind = kindForFloor(floor, rng);
    }
    used.add(kind);
    platforms.push(...buildModule(floor, kind, rng, `f${floor}`));
  }

  ensureClimbable(platforms);

  return { seed, floors: FLOOR_COUNT, platforms };
}

export function moduleKindsInBlueprint(bp: TowerBlueprint): ModuleKind[] {
  return [...new Set(bp.platforms.map((p) => p.kind))];
}

/**
 * Walks the tower the way a player would: from the spawn floor, hop to any
 * platform within jump range, and confirm the win pad is reachable. Returns
 * the highest floor a player can actually get to.
 */
export function highestReachableFloor(bp: TowerBlueprint): number {
  const reachable = reachableSet(bp.platforms);
  return bp.platforms
    .filter((p) => reachable.has(p.id))
    .reduce((best, p) => Math.max(best, p.floor), 0);
}

/** Every floor is climbable and the win pad can be reached from the spawn. */
export function validateReachable(bp: TowerBlueprint): boolean {
  const win = bp.platforms.find((p) => p.isWin);
  if (!win) return false;
  for (let floor = 1; floor <= bp.floors; floor++) {
    const plats = bp.platforms.filter((p) => p.floor === floor && isStandable(p));
    if (plats.length === 0) return false;
    if (Math.max(...plats.map(topOf)) < floorY(floor) - 0.5) return false;
  }
  return highestReachableFloor(bp) >= bp.floors;
}
