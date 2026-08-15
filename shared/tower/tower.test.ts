import { describe, expect, it } from 'vitest';
import {
  generateTower,
  highestReachableFloor,
  moduleKindsInBlueprint,
  validateReachable,
} from './generator';
import { computeShove } from './shove';
import { cameraForward, cameraOffset, cameraRight, lineHitsCore, moveFromCamera, outsideCore, outwardLookYaw } from './camera';
import { simulatePrizePool } from './prize';
import { TowerEngine } from './engine';
import { detectMoments } from './moments';
import type { TowerInput, TowerPlayerState } from './types';
import { FLOOR_COUNT, FLOOR_STEP_GAP, MAX_JUMP_HEIGHT } from './constants';
import { TOWER_BOT_AVATARS, TOWER_BOT_COLORS, TOWER_BOT_NAMES } from './bots';

function input(over: Partial<TowerInput> = {}): TowerInput {
  return {
    seq: 0,
    ax: 0,
    az: 0,
    jump: false,
    jumpHeld: false,
    shove: false,
    dodge: false,
    yaw: 0,
    ...over,
  };
}

function fighter(i: number, human = false) {
  return {
    id: human ? 'human' : `bot-${i}`,
    username: human ? 'You' : `Bot ${TOWER_BOT_NAMES[i % TOWER_BOT_NAMES.length]}`,
    avatar: TOWER_BOT_AVATARS[i % TOWER_BOT_AVATARS.length],
    color: TOWER_BOT_COLORS[i % TOWER_BOT_COLORS.length],
    isBot: !human,
  };
}

function dummyPlayer(over: Partial<TowerPlayerState> = {}): TowerPlayerState {
  return {
    id: 'a',
    username: 'A',
    avatar: '🐸',
    color: '#22e5ff',
    isBot: false,
    x: 0,
    y: 1,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    alive: true,
    grounded: true,
    floor: 1,
    maxFloor: 1,
    anim: 'idle',
    shoveCd: 0,
    ragdoll: 0,
    ledge: 0,
    dodge: 0,
    climb: 0,
    coyote: 0,
    shoves: 0,
    fallsSurvived: 0,
    lastShovedBy: null,
    lastShoveAt: 0,
    eliminatedAt: null,
    finishTime: null,
    placement: null,
    onId: 'p',
    jumpBuffer: 0,
    jumping: false,
    dodgeCd: 0,
    forfeited: false,
    skill: 1,
    ...over,
  };
}

describe('tower generator', () => {
  it('builds 30 reachable floors with a win pad', () => {
    for (const seed of [1, 7, 99, 12345]) {
      const bp = generateTower(seed);
      expect(bp.floors).toBe(FLOOR_COUNT);
      expect(validateReachable(bp)).toBe(true);
      expect(bp.platforms.some((p) => p.isWin)).toBe(true);
      expect(moduleKindsInBlueprint(bp).length).toBeGreaterThanOrEqual(8);
    }
  });

  it('leaves no floor stranded above jump range', () => {
    // Authored modules top out ~3 units below the next floor, which no jump can
    // clear. The generator patches those gaps; if it stops doing so the tower
    // silently becomes unwinnable.
    for (let seed = 1; seed <= 40; seed++) {
      const bp = generateTower(seed);
      expect(highestReachableFloor(bp)).toBe(FLOOR_COUNT);
    }
  });

  it('keeps every inserted step within a single jump', () => {
    expect(FLOOR_STEP_GAP).toBeLessThan(MAX_JUMP_HEIGHT);
    const bp = generateTower(4242);
    for (const step of bp.platforms.filter((p) => p.isStep)) {
      const below = bp.platforms.filter(
        (p) => p.id !== step.id && !p.fake && p.y < step.y && step.y - p.y <= MAX_JUMP_HEIGHT,
      );
      expect(below.length).toBeGreaterThan(0);
    }
  });
});

describe('camera-relative movement', () => {
  // Three.js is Y-up right-handed: a camera looking down -Z has +X on screen
  // right, so screen-right is cross(forward, up).
  const cross = (f: { x: number; z: number }) => ({ x: -f.z * 1, z: f.x * 1 });

  it('derives screen-right as cross(forward, up)', () => {
    for (const yaw of [0, 0.7, -1.9, Math.PI, 2.6]) {
      const f = cameraForward(yaw);
      const r = cameraRight(yaw);
      const expected = cross(f);
      expect(r.x).toBeCloseTo(expected.x, 6);
      expect(r.z).toBeCloseTo(expected.z, 6);
      expect(f.x * r.x + f.z * r.z).toBeCloseTo(0, 6);
    }
  });

  it('sends forward away from the camera and strafe to screen right', () => {
    // Camera at yaw 0 sits on -Z looking toward +Z.
    const fwd = moveFromCamera(0, 0, 1);
    expect(fwd.z).toBeCloseTo(1, 6);
    expect(fwd.x).toBeCloseTo(0, 6);

    const right = moveFromCamera(0, 1, 0);
    expect(right.x).toBeCloseTo(-1, 6);
    expect(right.z).toBeCloseTo(0, 6);
  });

  it('rotates the whole control scheme with the camera', () => {
    // Quarter turn: forward should now point along the new look direction.
    const yaw = Math.PI / 2;
    const fwd = moveFromCamera(yaw, 0, 1);
    expect(fwd.x).toBeCloseTo(1, 6);
    expect(fwd.z).toBeCloseTo(0, 6);
  });

  it('never exceeds unit speed on diagonals', () => {
    const d = moveFromCamera(1.1, 1, 1);
    expect(Math.hypot(d.x, d.z)).toBeCloseTo(1, 6);
  });

  it('pushes a camera sitting inside the core back out', () => {
    const p = outsideCore(0.2, 0.1, 2.15);
    expect(Math.hypot(p.x, p.z)).toBeCloseTo(2.15, 6);
    const already = outsideCore(4, 0, 2.15);
    expect(already.x).toBe(4);
    expect(already.z).toBe(0);
  });

  it('aims outward so a +Z spawn does not look through the tower', () => {
    const yaw = outwardLookYaw(0, 3.6);
    const off = cameraOffset(yaw, 0, 8);
    expect(off.z).toBeGreaterThan(6);
    expect(Math.abs(off.x)).toBeLessThan(0.01);
    expect(Math.cos(yaw)).toBeCloseTo(-1, 6);
  });

  it('places the lens behind the look direction', () => {
    const off = cameraOffset(0, 0, 8);
    expect(off.x).toBeCloseTo(0, 6);
    expect(off.y).toBeCloseTo(0, 6);
    expect(off.z).toBeCloseTo(-8, 6);
  });

  it('detects a sightline that crosses the core', () => {
    expect(lineHitsCore(0, 3, 0, -6, 1.2)).toBe(true);
    expect(lineHitsCore(4, 0, 8, 0, 1.2)).toBe(false);
  });
});

describe('prize pool', () => {
  it('uses 5% fee on a 1000 credit match', () => {
    const p = simulatePrizePool();
    expect(p.gross).toBe(1000);
    expect(p.platformFee).toBe(50);
    expect(p.prize).toBe(950);
    expect(p.disclaimer).toContain('NO REAL-WORLD VALUE');
  });
});

describe('shove', () => {
  it('knocks a target backward with more force near edges', () => {
    const atk = dummyPlayer({ id: 'atk', x: 0, z: 0, yaw: 0, vx: 6 });
    const tgt = dummyPlayer({ id: 'tgt', x: 0, z: 1.2, grounded: true });
    const stable = computeShove(atk, tgt, false);
    const edge = computeShove(atk, tgt, true);
    expect(stable.applied).toBe(true);
    expect(edge.impulse).toBeGreaterThan(stable.impulse);
    expect(edge.ragdoll || stable.ragdoll).toBe(true);
  });

  it('rejects targets outside the facing cone', () => {
    const atk = dummyPlayer({ yaw: 0, x: 0, z: 0 });
    const tgt = dummyPlayer({ x: 0, z: -1.2 });
    expect(computeShove(atk, tgt, false).applied).toBe(false);
  });
});

describe('moments', () => {
  it('detects biggest shove and fall', () => {
    const players = [dummyPlayer({ id: 'alex', username: 'Alex' }), dummyPlayer({ id: 'sam', username: 'Sam' })];
    const moments = detectMoments(players, [
      { t: 1, kind: 'shove', actorId: 'alex', floor: 18 },
      { t: 2, kind: 'shove_ko', actorId: 'alex', floor: 18 },
      { t: 3, kind: 'fall', targetId: 'sam', mag: 11 },
      { t: 4, kind: 'ledge_save', targetId: 'sam', mag: 0.3 },
      { t: 5, kind: 'final' },
    ]);
    expect(moments.some((m) => m.kind === 'biggest_shove')).toBe(true);
    expect(moments.some((m) => m.kind === 'biggest_fall')).toBe(true);
    expect(moments.some((m) => m.kind === 'last_second_save')).toBe(true);
  });
});

describe('tower engine', () => {
  it('keeps the player safe through the opening countdown', () => {
    const fighters = [fighter(0, true), ...Array.from({ length: 9 }, (_, i) => fighter(i + 1))];
    const engine = new TowerEngine({ seed: 42, matchId: 'opening', fighters, practice: true });
    for (let i = 0; i < 60 * 5; i++) engine.step(1000 / 60);
    const human = engine.players.find((player) => player.id === 'human');
    expect(human?.alive).toBe(true);
    expect(human?.y).toBeGreaterThan(-1);
  });

  it('moves the player from arrow-equivalent axis input', () => {
    const fighters = [fighter(0, true), ...Array.from({ length: 9 }, (_, i) => fighter(i + 1))];
    const engine = new TowerEngine({ seed: 42, matchId: 'movement', fighters, practice: true });
    const startX = engine.players[0].x;
    for (let i = 0; i < 60 * 4; i++) {
      const moving = i >= 185 && i < 200;
      engine.setInput('human', {
        seq: i + 1,
        ax: moving ? 1 : 0,
        az: 0,
        jump: false,
        shove: false,
        dodge: false,
        yaw: Math.PI / 2,
      });
      engine.step(1000 / 60);
    }
    const human = engine.players[0];
    expect(human.alive).toBe(true);
    expect(human.x).toBeGreaterThan(startX + 0.5);
  });

  it('simulates a match to completion', () => {
    const fighters = [fighter(0, true), ...Array.from({ length: 9 }, (_, i) => fighter(i + 1))];
    const engine = new TowerEngine({ seed: 42, matchId: 't1', fighters, practice: true });
    for (let i = 0; i < 60 * 200 && !engine.finished; i++) {
      engine.setInput('human', {
        seq: i + 1,
        ax: 0,
        az: -1,
        jump: i % 40 === 0,
        shove: i % 70 === 0,
        dodge: false,
        yaw: 0,
      });
      engine.step(1000 / 60);
    }
    expect(engine.finished).toBe(true);
    expect(engine.result).toBeTruthy();
    expect(engine.result?.participants).toHaveLength(10);
    expect(engine.result?.prize).toBe(0);
    const snap = engine.snapshot();
    expect(snap.floorCount).toBe(30);
  });

  it('clears a full floor step from a held jump', () => {
    const fighters = [fighter(0, true), ...Array.from({ length: 9 }, (_, i) => fighter(i + 1))];
    const engine = new TowerEngine({ seed: 42, matchId: 'jump', fighters, practice: true });
    for (let i = 0; i < 60 * 4; i++) engine.step(1000 / 60);
    const human = engine.players[0];
    const start = human.y;

    engine.setInput('human', input({ seq: 1, jump: true, jumpHeld: true }));
    let peak = start;
    for (let i = 0; i < 60; i++) {
      engine.setInput('human', input({ seq: i + 2, jumpHeld: true }));
      engine.step(1000 / 60);
      peak = Math.max(peak, engine.players[0].y);
    }
    expect(peak - start).toBeGreaterThan(FLOOR_STEP_GAP);
  });

  it('makes a tapped jump shorter than a held one', () => {
    const build = () => {
      const fighters = [fighter(0, true), ...Array.from({ length: 9 }, (_, i) => fighter(i + 1))];
      const e = new TowerEngine({ seed: 42, matchId: 'cut', fighters, practice: true });
      for (let i = 0; i < 60 * 4; i++) e.step(1000 / 60);
      return e;
    };
    const apex = (held: boolean) => {
      const e = build();
      const start = e.players[0].y;
      e.setInput('human', input({ seq: 1, jump: true, jumpHeld: true }));
      let peak = start;
      for (let i = 0; i < 60; i++) {
        e.setInput('human', input({ seq: i + 2, jumpHeld: held }));
        e.step(1000 / 60);
        peak = Math.max(peak, e.players[0].y);
      }
      return peak - start;
    };
    expect(apex(false)).toBeLessThan(apex(true) * 0.85);
  });

  it('does not drop a jump pressed between simulation ticks', () => {
    const fighters = [fighter(0, true), ...Array.from({ length: 9 }, (_, i) => fighter(i + 1))];
    const engine = new TowerEngine({ seed: 42, matchId: 'buffer', fighters, practice: true });
    for (let i = 0; i < 60 * 4; i++) engine.step(1000 / 60);
    const start = engine.players[0].y;

    // Press and release inside one client frame, the way a quick tap arrives.
    engine.setInput('human', input({ seq: 1, jump: true, jumpHeld: true }));
    engine.setInput('human', input({ seq: 2, jump: false, jumpHeld: false }));
    for (let i = 0; i < 12; i++) engine.step(1000 / 60);
    expect(engine.players[0].y).toBeGreaterThan(start + 0.4);
  });

  it('keeps eliminated players falling instead of freezing mid-air', () => {
    const fighters = [fighter(0, true), ...Array.from({ length: 9 }, (_, i) => fighter(i + 1))];
    const engine = new TowerEngine({ seed: 42, matchId: 'dead', fighters, practice: true });
    for (let i = 0; i < 60 * 4; i++) engine.step(1000 / 60);

    engine.forfeit('human');
    const human = engine.players.find((p) => p.id === 'human')!;
    expect(human.alive).toBe(false);
    expect(human.forfeited).toBe(true);
    expect(human.placement).toBeGreaterThan(1);

    const before = human.y;
    for (let i = 0; i < 60 && !engine.finished; i++) engine.step(1000 / 60);
    expect(human.y).toBeLessThan(before - 5);

    const snap = engine.snapshot();
    const dead = snap.players.find((p) => p.id === 'human')!;
    expect(dead.deadFor).toBeGreaterThan(0);
    expect(snap.players.filter((p) => p.alive).length).toBe(snap.aliveCount);
  });

  it('is not decided by a shove scrum on the spawn floor', () => {
    // A single shove used to hit everyone in the cone with ~28 impulse and no
    // knockback drag, so the whole lobby was launched off floor 1 within
    // seconds of the countdown ending.
    let best = 0;
    for (const seed of [42, 7, 5]) {
      const fighters = [fighter(0, true), ...Array.from({ length: 9 }, (_, i) => fighter(i + 1))];
      const engine = new TowerEngine({ seed, matchId: `s${seed}`, fighters, practice: true });
      for (let i = 0; i < 60 * 220 && !engine.finished; i++) engine.step(1000 / 60);
      expect(engine.time).toBeGreaterThan(30);
      best = Math.max(best, ...engine.players.map((p) => p.maxFloor));
    }
    expect(best).toBeGreaterThanOrEqual(4);
  }, 30_000);

  it('shoves one rival rather than everyone in front of you', () => {
    // Humans only, so nobody moves without input we supply.
    const fighters = Array.from({ length: 4 }, (_, i) => ({
      ...fighter(i, true),
      id: `p${i}`,
      isBot: false,
    }));
    const engine = new TowerEngine({ seed: 42, matchId: 'aoe', fighters, practice: true });
    for (let i = 0; i < 60 * 7; i++) engine.step(1000 / 60);

    const [attacker, ...targets] = engine.players;
    attacker.x = 0;
    attacker.z = 0;
    attacker.shoveCd = 0;
    targets.forEach((t, i) => {
      t.x = (i - 1) * 0.35;
      t.z = 1.1;
      t.y = attacker.y;
      t.lastShovedBy = null;
    });

    engine.setInput(attacker.id, input({ seq: 99, shove: true, yaw: 0 }));
    engine.step(1000 / 60);
    expect(targets.filter((t) => t.lastShovedBy === attacker.id)).toHaveLength(1);
  });

  it('triggers collapse in final phase', () => {
    const fighters = [fighter(0, true), ...Array.from({ length: 9 }, (_, i) => fighter(i + 1))];
    const engine = new TowerEngine({ seed: 3, matchId: 't2', fighters, practice: true });
    for (let i = 0; i < 60 * 8; i++) engine.step(1000 / 60);
    engine.phase = 'final';
    const before = engine.collapseY;
    for (let i = 0; i < 60; i++) engine.step(1000 / 60);
    expect(engine.collapseY).toBeGreaterThan(before);
  });
});
