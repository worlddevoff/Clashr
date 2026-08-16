import {
  AIR_CONTROL,
  AIR_DRAG_TIME,
  CLIMB_SPEED,
  COLLAPSE_SPEED_MIN,
  COUNTDOWN_SEC,
  COYOTE_TIME,
  DODGE_COOLDOWN,
  DODGE_SPEED,
  DODGE_TIME,
  FALL_GRAVITY_MULT,
  FINAL_ALIVE_THRESHOLD,
  FINAL_PHASE_AT,
  FINAL_TRIGGER_FLOOR,
  FLOOR_COUNT,
  FLOOR_HEIGHT,
  GRAVITY,
  GROUND_ACCEL_TIME,
  GROUND_FRICTION_TIME,
  JUMP_BUFFER,
  JUMP_CUT,
  JUMP_SPEED,
  LEDGE_GRAB_WINDOW,
  MATCH_TIME_LIMIT,
  MAX_JUMP_HEIGHT,
  MOVE_SPEED,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  RAGDOLL_DRAG_TIME,
  RAGDOLL_TIME,
  SHOVE_COOLDOWN,
  SHOVE_RANGE,
  TERMINAL_VELOCITY,
  TICK_HZ,
} from './constants';
import { generateTower } from './generator';
import { detectMoments } from './moments';
import { simulatePrizePool } from './prize';
import { computeShove, facingDot } from './shove';
import type {
  MatchPhase,
  MovingSnap,
  TowerBlueprint,
  TowerEvent,
  TowerInput,
  TowerMatchResult,
  TowerPlatform,
  TowerPlayerSnap,
  TowerPlayerState,
  TowerSnapshot,
} from './types';

export interface TowerFighter {
  id: string;
  username: string;
  avatar: string;
  color: string;
  isBot: boolean;
}

interface WorldPlat {
  src: TowerPlatform;
  x: number;
  y: number;
  z: number;
  rotY: number;
  /** Previous-frame transform, used to carry riders on moving platforms. */
  px: number;
  py: number;
  pz: number;
  pRotY: number;
  enabled: boolean;
  stood: number;
}

function emptyInput(): TowerInput {
  return { seq: 0, ax: 0, az: 0, jump: false, jumpHeld: false, shove: false, dodge: false, yaw: 0 };
}

/** Coerce anything off the wire to a usable number. NaN/undefined become 0. */
function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function clamp1(v: number): number {
  return v < -1 ? -1 : v > 1 ? 1 : v;
}

function spawnRing(i: number, n: number): { x: number; z: number } {
  const a = (i / n) * Math.PI * 2;
  return { x: Math.sin(a) * 3.6, z: Math.cos(a) * 3.6 };
}

/** Frame-rate independent approach factor for an exponential ease with time constant tau. */
function approach(dt: number, tau: number): number {
  return 1 - Math.exp(-dt / Math.max(0.0001, tau));
}

/**
 * Match standing. Survivors always outrank the eliminated: running the clock
 * out on floor 10 beats having died on floor 12. Used for both the live
 * scoreboard and the final placement table so the two never disagree.
 */
function byStanding(a: TowerPlayerState, b: TowerPlayerState): number {
  if (a.alive !== b.alive) return a.alive ? -1 : 1;
  if (b.maxFloor !== a.maxFloor) return b.maxFloor - a.maxFloor;
  return b.y - a.y;
}

export class TowerEngine {
  readonly id = 'tower';
  readonly blueprint: TowerBlueprint;
  readonly matchId: string;
  players: TowerPlayerState[] = [];
  inputs = new Map<string, TowerInput>();
  tick = 0;
  time = 0;
  phase: MatchPhase = 'countdown';
  countdown = COUNTDOWN_SEC;
  collapseY = -4;
  /** Derived when the endgame starts; see `maybeFinal`. */
  private collapseRate = COLLAPSE_SPEED_MIN;
  events: TowerEvent[] = [];
  recent: TowerEvent[] = [];
  finished = false;
  result: TowerMatchResult | null = null;
  camera: TowerSnapshot['camera'] = 'follow';
  slowMo = 0;
  shake = 0;
  private world: WorldPlat[] = [];
  private byId = new Map<string, WorldPlat>();
  private winPad: WorldPlat | null = null;
  private dt = 1 / TICK_HZ;
  private botThink = new Map<string, number>();
  readonly practice: boolean;

  constructor(opts: { seed: number; matchId: string; fighters: TowerFighter[]; practice?: boolean }) {
    this.matchId = opts.matchId;
    this.practice = !!opts.practice;
    this.blueprint = generateTower(opts.seed);
    this.world = this.blueprint.platforms.map((p) => ({
      src: p,
      x: p.x,
      y: p.y,
      z: p.z,
      rotY: p.rotY,
      px: p.x,
      py: p.y,
      pz: p.z,
      pRotY: p.rotY,
      enabled: true,
      stood: 0,
    }));
    for (const w of this.world) this.byId.set(w.src.id, w);
    this.winPad = this.world.find((w) => w.src.isWin) ?? null;
    this.players = opts.fighters.map((f, i) => {
      const s = spawnRing(i, opts.fighters.length);
      return {
        ...f,
        x: s.x,
        y: 1.2,
        z: s.z,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: Math.atan2(-s.x, -s.z),
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
        onId: null,
        jumpBuffer: 0,
        jumping: false,
        dodgeCd: 0,
        forfeited: false,
        skill: f.isBot ? 0.35 + ((i * 0.37) % 0.65) : 1,
      };
    });
  }

  setInput(playerId: string, input: TowerInput): void {
    const p = this.players.find((x) => x.id === playerId);
    if (!p || !p.alive || p.isBot) return;
    const seq = num(input.seq);
    const prev = this.inputs.get(playerId);
    if (prev && seq && seq <= prev.seq) return;
    // Jump and dodge are edge-triggered. Latching them into a buffer here keeps
    // them reliable no matter how the client's input rate lines up with ticks:
    // a press is never dropped, and never re-fires on later ticks.
    if (input.jump) p.jumpBuffer = JUMP_BUFFER;
    // Nothing off the wire is trusted. Clamping each axis alone still let a
    // hand-rolled client send (1, 1) for 41% free diagonal speed, and a
    // non-numeric axis poisoned the position with NaN — which the void check
    // can never catch, so that player would survive the whole match.
    let ax = clamp1(num(input.ax));
    let az = clamp1(num(input.az));
    const mag = Math.hypot(ax, az);
    if (mag > 1) {
      ax /= mag;
      az /= mag;
    }
    this.inputs.set(playerId, {
      seq,
      ax,
      az,
      jump: false,
      jumpHeld: !!input.jumpHeld,
      shove: !!input.shove,
      dodge: !!input.dodge,
      yaw: num(input.yaw),
    });
  }

  /** Player left the match on purpose: rank them where they stand, keep the sim going. */
  forfeit(playerId: string): void {
    const p = this.players.find((x) => x.id === playerId);
    if (!p || !p.alive) return;
    p.forfeited = true;
    this.eliminate(p, 'left the match');
  }

  step(dtMs?: number): void {
    if (this.finished) return;
    const dt = dtMs != null ? Math.min(0.05, dtMs / 1000) : this.dt;
    this.tick += 1;
    this.time += dt;
    this.recent = [];
    this.shake = Math.max(0, this.shake - dt * 4);
    this.slowMo = Math.max(0, this.slowMo - dt);

    if (this.phase === 'countdown') {
      this.countdown = Math.max(0, COUNTDOWN_SEC - this.time);
      this.updateKinematics(this.time);
      // Settle everyone onto the spawn floor so the match starts from a stance
      // instead of dropping the whole lobby the instant the countdown ends.
      for (const p of this.players) this.stepPlayer(p, dt, true);
      if (this.time >= COUNTDOWN_SEC) this.phase = 'live';
      return;
    }

    this.updateKinematics(this.time);
    this.thinkBots(dt);

    for (const p of this.players) {
      if (p.alive) this.stepPlayer(p, dt);
      else this.stepDead(p, dt);
    }

    this.resolveShoves();
    this.updateFloors();
    this.checkWin();
    this.updateCollapse(dt);
    this.cullFallen();
    this.maybeFinal();
    this.maybeTimeout();
  }

  snapshot(): TowerSnapshot {
    const alive = this.players.filter((p) => p.alive);
    const ranked = [...this.players].sort(byStanding);
    const players: TowerPlayerSnap[] = this.players.map((p) => ({
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      color: p.color,
      isBot: p.isBot,
      x: p.x,
      y: p.y,
      z: p.z,
      vx: p.vx,
      vy: p.vy,
      vz: p.vz,
      yaw: p.yaw,
      alive: p.alive,
      floor: p.floor,
      maxFloor: p.maxFloor,
      anim: p.anim,
      shoveCd: p.shoveCd,
      dodgeCd: p.dodgeCd,
      grounded: p.grounded,
      rank: ranked.findIndex((r) => r.id === p.id) + 1,
      shoves: p.shoves,
      fallsSurvived: p.fallsSurvived,
      placement: p.placement,
      deadFor: p.eliminatedAt == null ? 0 : this.time - p.eliminatedAt,
    }));
    const moving: MovingSnap[] = this.world
      .filter((w) => w.src.motion)
      .map((w) => ({ id: w.src.id, x: w.x, y: w.y, z: w.z, rotY: w.rotY }));

    let camera: TowerSnapshot['camera'] = 'follow';
    if (this.phase === 'final' || this.phase === 'finished') camera = 'final';
    else if (this.recent.some((e) => e.kind === 'ledge_save')) camera = 'ledge';
    else if (this.recent.some((e) => e.kind === 'fall' || e.kind === 'shove_ko')) camera = 'fall';

    return {
      tick: this.tick,
      time: this.time,
      phase: this.phase,
      seed: this.blueprint.seed,
      countdown: this.countdown,
      collapseY: this.collapseY,
      aliveCount: alive.length,
      floorCount: FLOOR_COUNT,
      warning: this.phase === 'final' ? 'THE TOWER IS COLLAPSING' : null,
      camera,
      slowMo: this.slowMo,
      shake: this.shake,
      players,
      moving,
      events: this.recent,
    };
  }

  private emit(e: TowerEvent): void {
    this.events.push(e);
    this.recent.push(e);
  }

  private updateKinematics(t: number): void {
    for (const w of this.world) {
      const m = w.src.motion;
      if (!m) continue;
      w.px = w.x;
      w.py = w.y;
      w.pz = w.z;
      w.pRotY = w.rotY;
      if (m.type === 'orbit') {
        const a = t * m.speed;
        w.x = Math.sin(a) * m.radius;
        w.z = Math.cos(a) * m.radius;
        w.y = m.height;
        w.rotY = a;
      } else if (m.type === 'slide') {
        const o = Math.sin(t * m.speed) * m.amp;
        w.x = w.src.x + (m.axis === 'x' ? o : 0);
        w.z = w.src.z + (m.axis === 'z' ? o : 0);
        w.y = w.src.y;
      } else if (m.type === 'elevate') {
        w.x = w.src.x;
        w.z = w.src.z;
        w.y = w.src.y + (Math.sin(t * m.speed) * 0.5 + 0.5) * m.amp;
      } else if (m.type === 'hammer' || m.type === 'beam') {
        w.x = w.src.x;
        w.y = w.src.y;
        w.z = w.src.z;
        w.rotY = t * m.speed;
      }
    }
  }

  /** Ride moving platforms: apply the platform's frame delta as a rigid transform. */
  private carry(p: TowerPlayerState): void {
    if (!p.onId) return;
    const w = this.byId.get(p.onId);
    if (!w || !w.src.motion) return;
    const dRot = w.rotY - w.pRotY;
    const ox = p.x - w.px;
    const oz = p.z - w.pz;
    const c = Math.cos(dRot);
    const s = Math.sin(dRot);
    p.x = w.x + (ox * c - oz * s);
    p.z = w.z + (ox * s + oz * c);
    p.y += w.y - w.py;
    p.yaw += dRot;
  }

  private stepPlayer(p: TowerPlayerState, dt: number, frozen = false): void {
    p.shoveCd = Math.max(0, p.shoveCd - dt);
    p.ragdoll = Math.max(0, p.ragdoll - dt);
    p.dodge = Math.max(0, p.dodge - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    p.climb = Math.max(0, p.climb - dt);
    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    const input = frozen ? emptyInput() : (this.inputs.get(p.id) ?? emptyInput());
    if (!p.isBot && Number.isFinite(input.yaw)) p.yaw = input.yaw;

    this.carry(p);

    if (p.ledge > 0) {
      p.ledge = Math.max(0, p.ledge - dt);
      p.vy = 0;
      p.vx *= 0.2;
      p.vz *= 0.2;
      p.anim = 'ledge';
      // Mash jump to vault up early, otherwise the climb fires automatically.
      if (p.ledge === 0 || p.jumpBuffer > 0) {
        p.jumpBuffer = 0;
        p.vy = JUMP_SPEED * 0.72;
        p.y += 0.35;
        p.ledge = 0;
        p.coyote = 0;
        p.anim = 'climb';
      }
      this.integrate(p, dt);
      return;
    }

    if (p.ragdoll > 0) {
      const drag = approach(dt, RAGDOLL_DRAG_TIME);
      p.vx -= p.vx * drag;
      p.vz -= p.vz * drag;
      p.vy -= this.gravityFor(p) * dt;
      p.anim = p.vy < -4 ? 'fall' : 'ragdoll';
      this.integrate(p, dt);
      return;
    }

    const grounded = p.grounded;
    if (grounded) p.coyote = COYOTE_TIME;
    else p.coyote = Math.max(0, p.coyote - dt);

    const wish = Math.hypot(input.ax, input.az);
    const speed = p.dodge > 0 ? DODGE_SPEED : MOVE_SPEED;
    const steering = wish > 0.05;
    // On the ground you stop on a dime; in the air you steer slower and coast,
    // which keeps jump momentum and lets a shoved player fight the knockback.
    const tau = grounded
      ? steering
        ? GROUND_ACCEL_TIME
        : GROUND_FRICTION_TIME
      : steering
        ? GROUND_ACCEL_TIME / AIR_CONTROL
        : AIR_DRAG_TIME;
    const k = approach(dt, tau);
    p.vx += (input.ax * speed - p.vx) * k;
    p.vz += (input.az * speed - p.vz) * k;

    if (input.dodge && p.dodge <= 0 && p.dodgeCd <= 0) {
      p.dodge = DODGE_TIME;
      p.dodgeCd = DODGE_COOLDOWN;
      const mag = wish || 1;
      const dx = wish > 0.05 ? input.ax / mag : Math.sin(p.yaw);
      const dz = wish > 0.05 ? input.az / mag : Math.cos(p.yaw);
      p.vx = dx * DODGE_SPEED;
      p.vz = dz * DODGE_SPEED;
    }

    const climbWall = this.touchingClimb(p);
    const wantsJump = p.jumpBuffer > 0;
    if (climbWall && wantsJump) {
      p.jumpBuffer = 0;
      p.vy = JUMP_SPEED * 0.85;
      p.vx += -Math.sign(climbWall.nx || 1) * 4.5;
      p.climb = 0.2;
      p.anim = 'climb';
    } else if (climbWall && wish > 0.2 && !grounded) {
      p.vy = Math.max(p.vy, CLIMB_SPEED);
      p.anim = 'climb';
    } else if ((grounded || p.coyote > 0) && wantsJump) {
      p.jumpBuffer = 0;
      p.vy = JUMP_SPEED;
      p.grounded = false;
      p.coyote = 0;
      p.jumping = true;
      p.anim = 'jump';
    } else {
      // Releasing jump before apex cuts the arc short, so a tap clears a low
      // step and a hold clears the full floor gap.
      if (p.jumping && p.vy > 0 && !input.jumpHeld && !p.isBot) {
        p.vy *= JUMP_CUT;
        p.jumping = false;
      }
      p.vy -= this.gravityFor(p) * dt;
    }
    if (p.vy <= 0) p.jumping = false;

    if (input.shove && p.shoveCd <= 0) {
      p.shoveCd = SHOVE_COOLDOWN;
      p.anim = 'shove';
      this.tryShove(p);
    }

    const moving = Math.hypot(p.vx, p.vz) > 0.6;
    if (p.anim !== 'shove' || p.shoveCd < SHOVE_COOLDOWN - 0.18) {
      if (!p.grounded) p.anim = p.vy < -2 ? 'fall' : 'jump';
      else p.anim = moving ? 'run' : 'idle';
    }

    this.integrate(p, dt);
  }

  private gravityFor(p: TowerPlayerState): number {
    return p.vy < 0 ? GRAVITY * FALL_GRAVITY_MULT : GRAVITY;
  }

  /** Eliminated players keep falling out of the world instead of freezing mid-air. */
  private stepDead(p: TowerPlayerState, dt: number): void {
    if (p.y < -140) return;
    p.vy -= GRAVITY * dt;
    p.vx *= 0.99;
    p.vz *= 0.99;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.yaw += dt * 2.2;
    p.anim = 'ragdoll';
  }

  private integrate(p: TowerPlayerState, dt: number): void {
    const prevY = p.y;
    p.vy = Math.max(-TERMINAL_VELOCITY, p.vy);
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    p.y += p.vy * dt;
    p.grounded = false;
    p.onId = null;

    const hit = this.collide(p, prevY, dt);
    if (hit?.hazard) {
      p.vx += hit.hx;
      p.vz += hit.hz;
      p.vy += 2.5;
      p.ragdoll = Math.max(p.ragdoll, 0.35);
      this.shake = Math.max(this.shake, 0.35);
      this.emit({ t: this.time, kind: 'impact', targetId: p.id, floor: p.floor, mag: 1 });
    }

    const lim = 14;
    p.x = Math.max(-lim, Math.min(lim, p.x));
    p.z = Math.max(-lim, Math.min(lim, p.z));

    // A non-finite position slips past every comparison below, including the
    // void check, and would leave the player standing forever. Drop them.
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      p.x = 0;
      p.z = 0;
      p.y = -100;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
    }

    if (p.y < this.collapseY - 6) this.eliminate(p, 'void');
  }

  private collide(
    p: TowerPlayerState,
    prevY: number,
    dt: number,
  ): { hazard: boolean; hx: number; hz: number } | null {
    let hazard = false;
    let hx = 0;
    let hz = 0;
    const r = PLAYER_RADIUS;
    const h = PLAYER_HEIGHT;

    for (const w of this.world) {
      if (!w.enabled) continue;
      if (w.y + w.src.sy < this.collapseY) continue;
      // Cheap broad phase. Every test below needs the player within a couple of
      // units of the slab, and the narrow phase costs two trig calls per slab —
      // with ~150 slabs and 10 players that dominated the tick.
      const lx = p.x - w.x;
      const lz = p.z - w.z;
      if (Math.abs(p.y - w.y) > w.src.sy / 2 + 2.5) continue;
      const reach = (w.src.sx + w.src.sz) * 0.5 + 1.2;
      if (lx * lx + lz * lz > reach * reach) continue;
      const hw = w.src.sx / 2;
      const hd = w.src.sz / 2;
      const hh = w.src.sy / 2;
      const c = Math.cos(-w.rotY);
      const s = Math.sin(-w.rotY);
      const rx = lx * c - lz * s;
      const rz = lx * s + lz * c;
      const px = Math.max(-hw, Math.min(hw, rx));
      const pz = Math.max(-hd, Math.min(hd, rz));
      const py = Math.max(w.y - hh, Math.min(w.y + hh, p.y + h * 0.45));
      const dx = rx - px;
      const dz = rz - pz;
      const dy = p.y + h * 0.45 - py;
      const dist = Math.hypot(dx, dz);
      const isBeam = w.src.motion?.type === 'hammer' || w.src.motion?.type === 'beam';

      const feet = p.y;
      const top = w.y + hh;
      const over =
        Math.abs(rx) < hw + r * 0.85 && Math.abs(rz) < hd + r * 0.85;
      const inside = Math.abs(rx) < hw + r * 0.4 && Math.abs(rz) < hd + r * 0.4;

      if (over && prevY >= top - 0.12 && feet <= top + 0.2 && p.vy <= 0.5 && !isBeam) {
        p.y = top;
        p.vy = 0;
        p.grounded = true;
        p.onId = w.src.id;
        if (w.src.conveyor) {
          const dirx = Math.sin(w.rotY);
          const dirz = Math.cos(w.rotY);
          p.vx += dirx * w.src.conveyor * dt;
          p.vz += dirz * w.src.conveyor * dt;
        }
        if (w.src.bounce && p.anim !== 'ledge') {
          p.vy = w.src.bounce;
          p.grounded = false;
          this.emit({ t: this.time, kind: 'bounce', targetId: p.id, floor: w.src.floor });
        }
        if (w.src.collapseAfter) {
          w.stood += dt;
          if (w.stood >= w.src.collapseAfter) w.enabled = false;
        }
        if (w.src.fake) {
          w.stood += dt;
          if (w.stood >= (w.src.collapseAfter ?? 0.6)) w.enabled = false;
        }
        continue;
      }

      if (isBeam && dist < r + 0.35 && Math.abs(p.y - w.y) < 1.6) {
        const mag = 11;
        const nx = dist > 0.001 ? dx / dist : Math.sin(w.rotY);
        const nz = dist > 0.001 ? dz / dist : Math.cos(w.rotY);
        p.vx += nx * mag;
        p.vz += nz * mag;
        p.vy += 4;
        p.ragdoll = RAGDOLL_TIME;
        hazard = true;
        hx += nx * mag;
        hz += nz * mag;
        continue;
      }

      // Platforms are one-way: you land on the top face and pass up through the
      // underside. The tower stacks overlapping slabs, so solid undersides would
      // trap players in dead ends. `inside` is excluded here because a player
      // directly beneath a slab has no sensible sideways escape direction.
      if (!inside && dist > 0.001 && dist < r && Math.abs(dy) < h * 0.55 && !isBeam) {
        const push = r - dist + 0.01;
        const nx = dx / dist;
        const nz = dz / dist;
        const wx = nx * c + nz * s;
        const wz = -nx * s + nz * c;
        p.x += wx * push;
        p.z += wz * push;
      }

      if (
        !p.grounded &&
        p.vy < -1 &&
        p.ledge <= 0 &&
        over &&
        feet < top &&
        feet > top - 1.1 &&
        (Math.abs(rx) > hw - 0.55 || Math.abs(rz) > hd - 0.55)
      ) {
        p.ledge = LEDGE_GRAB_WINDOW;
        p.y = top - 0.35;
        p.vy = 0;
        p.fallsSurvived += 1;
        this.slowMo = Math.max(this.slowMo, 0.45);
        this.camera = 'ledge';
        this.emit({
          t: this.time,
          kind: 'ledge_save',
          targetId: p.id,
          floor: w.src.floor,
          mag: 0.3,
          text: `${p.username} grabbed the ledge`,
        });
      }
    }
    return hazard ? { hazard, hx, hz } : null;
  }

  /** Is there a surface to land on near (x, z) at roughly this height? */
  private groundNear(x: number, z: number, y: number): boolean {
    for (const w of this.world) {
      if (!w.enabled) continue;
      if (w.src.fake) continue;
      if (w.src.motion?.type === 'hammer' || w.src.motion?.type === 'beam') continue;
      const top = w.y + w.src.sy / 2;
      if (top > y + 0.8 || top < y - 3) continue;
      const lx = x - w.x;
      const lz = z - w.z;
      const reach = (w.src.sx + w.src.sz) * 0.5;
      if (lx * lx + lz * lz > reach * reach) continue;
      const c = Math.cos(-w.rotY);
      const s = Math.sin(-w.rotY);
      const rx = lx * c - lz * s;
      const rz = lx * s + lz * c;
      if (Math.abs(rx) < w.src.sx / 2 && Math.abs(rz) < w.src.sz / 2) return true;
    }
    return false;
  }

  private touchingClimb(p: TowerPlayerState): { nx: number } | null {
    for (const w of this.world) {
      if (!w.enabled || !w.src.climbable) continue;
      const d = Math.hypot(p.x - w.x, p.z - w.z);
      if (d < PLAYER_RADIUS + w.src.sx && Math.abs(p.y - w.y) < w.src.sy) {
        return { nx: p.x - w.x };
      }
    }
    return null;
  }

  private tryShove(attacker: TowerPlayerState): void {
    // Give everyone time to orient after GO. Without this, bot opponents can
    // chain-shove a player before their first movement input is visible.
    if (this.time < COUNTDOWN_SEC + 3) return;

    // A shove is a directed push at one rival. Applying it to everyone in the
    // cone turned a single press into a lobby-wide blast.
    let target: TowerPlayerState | null = null;
    let best = -Infinity;
    let result: ReturnType<typeof computeShove> | null = null;
    for (const t of this.players) {
      if (t.id === attacker.id || !t.alive) continue;
      if (Math.abs(t.y - attacker.y) > PLAYER_HEIGHT * 1.5) continue;
      const res = computeShove(attacker, t, this.nearEdge(t));
      if (!res.applied) continue;
      const score = facingDot(attacker, t) - Math.hypot(t.x - attacker.x, t.z - attacker.z) * 0.2;
      if (score > best) {
        best = score;
        target = t;
        result = res;
      }
    }
    if (!target || !result) return;

    const nearEdge = result.nearEdge;
    target.vx += result.dx * result.impulse;
    target.vz += result.dz * result.impulse;
    target.vy += 2.6 + (nearEdge ? 1.2 : 0);
    target.grounded = false;
    target.lastShovedBy = attacker.id;
    target.lastShoveAt = this.time;
    attacker.shoves += 1;
    if (result.ragdoll) target.ragdoll = RAGDOLL_TIME;
    this.shake = 0.7;
    if (nearEdge) this.slowMo = 0.55;
    this.emit({
      t: this.time,
      kind: nearEdge ? 'shove_ko' : 'shove',
      actorId: attacker.id,
      targetId: target.id,
      floor: attacker.floor,
      mag: result.impulse,
      text: `${attacker.username} shoved ${target.username}`,
    });
  }

  private resolveShoves(): void {
    // extra player-player overlap push
    for (let i = 0; i < this.players.length; i++) {
      const a = this.players[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < this.players.length; j++) {
        const b = this.players[j];
        if (!b.alive) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = PLAYER_RADIUS * 2;
        if (d < min && d > 0.001 && Math.abs(a.y - b.y) < PLAYER_HEIGHT) {
          const push = (min - d) * 0.5;
          a.x -= (dx / d) * push;
          a.z -= (dz / d) * push;
          b.x += (dx / d) * push;
          b.z += (dz / d) * push;
        }
      }
    }
  }

  private nearEdge(p: TowerPlayerState): boolean {
    if (!p.onId) return true;
    const w = this.byId.get(p.onId);
    if (!w) return true;
    const dx = Math.abs(p.x - w.x);
    const dz = Math.abs(p.z - w.z);
    return dx > w.src.sx * 0.38 || dz > w.src.sz * 0.38;
  }

  private updateFloors(): void {
    for (const p of this.players) {
      if (!p.alive) continue;
      const f = Math.max(1, Math.min(FLOOR_COUNT, Math.floor(p.y / FLOOR_HEIGHT) + 1));
      if (f + 2 < p.floor) {
        const drop = p.floor - f;
        p.fallsSurvived += 1;
        this.emit({
          t: this.time,
          kind: 'fall',
          targetId: p.id,
          actorId: p.lastShovedBy ?? undefined,
          floor: p.floor,
          mag: drop,
          text: `${p.username} fell ${drop} floors`,
        });
        this.slowMo = Math.max(this.slowMo, 0.4);
      }
      p.floor = f;
      p.maxFloor = Math.max(p.maxFloor, f);
    }
  }

  private checkWin(): void {
    if (this.finished) return;
    const win = this.winPad;
    if (!win || !win.enabled) return;
    for (const p of this.players) {
      if (!p.alive) continue;
      const dx = Math.abs(p.x - win.x);
      const dz = Math.abs(p.z - win.z);
      if (dx < win.src.sx * 0.55 && dz < win.src.sz * 0.55 && Math.abs(p.y - win.y) < 1.4) {
        p.anim = 'victory';
        p.finishTime = this.time;
        this.finish(p);
        return;
      }
    }
  }

  private updateCollapse(dt: number): void {
    if (this.phase !== 'final') return;
    this.collapseY += this.collapseRate * dt;
    for (const p of this.players) {
      if (p.alive && p.y < this.collapseY - 1.2) this.eliminate(p, 'collapse');
    }
  }

  private cullFallen(): void {
    for (const p of this.players) {
      if (p.alive && p.y < -8) this.eliminate(p, 'void');
    }
  }

  private maybeFinal(): void {
    if (this.phase !== 'live') return;
    const alive = this.players.filter((p) => p.alive);
    const high = alive.some((p) => p.maxFloor >= FINAL_TRIGGER_FLOOR);
    const fieldNarrowed =
      this.players.length > FINAL_ALIVE_THRESHOLD && alive.length <= FINAL_ALIVE_THRESHOLD;
    if (fieldNarrowed || this.time > MATCH_TIME_LIMIT * FINAL_PHASE_AT || high) {
      this.phase = 'final';
      // Pace the kill plane to crest the summit exactly as the clock expires,
      // whether the collapse was triggered by the timer or by an early climber.
      const climb = FLOOR_COUNT * FLOOR_HEIGHT + 6 - this.collapseY;
      const left = Math.max(12, MATCH_TIME_LIMIT - this.time);
      this.collapseRate = Math.max(COLLAPSE_SPEED_MIN, climb / left);
      this.emit({ t: this.time, kind: 'final', text: 'THE TOWER IS COLLAPSING' });
      this.shake = 1;
    }
  }

  private maybeTimeout(): void {
    if (this.time < MATCH_TIME_LIMIT && this.players.some((p) => p.alive)) return;
    if (this.finished) return;
    const winner = [...this.players].sort(byStanding)[0];
    if (winner) this.finish(winner);
  }

  private eliminate(p: TowerPlayerState, why: string): void {
    if (!p.alive) return;
    p.alive = false;
    p.anim = 'fall';
    p.eliminatedAt = this.time;
    const remaining = this.players.filter((x) => x.alive).length;
    p.placement = remaining + 1;
    this.emit({
      t: this.time,
      kind: 'elim',
      targetId: p.id,
      actorId: p.lastShovedBy ?? undefined,
      floor: p.floor,
      text: `${p.username} eliminated (${why})`,
    });
    const alive = this.players.filter((x) => x.alive);
    if (alive.length === 1) this.finish(alive[0]);
    if (alive.length === 0) this.finish(p);
  }

  private finish(winner: TowerPlayerState): void {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'finished';
    winner.alive = true;
    winner.anim = 'victory';
    winner.placement = 1;
    winner.finishTime = winner.finishTime ?? this.time;
    this.emit({ t: this.time, kind: 'win', actorId: winner.id, text: `${winner.username} wins` });

    const pool = simulatePrizePool();
    // Everyone still standing ranks directly behind the winner. Eliminations
    // already reserved the tail of the table on the way down (the first player
    // out took last place), so places 2..N here are exactly the free ones.
    const survivors = this.players.filter((p) => p.id !== winner.id && p.placement == null);
    survivors.sort(byStanding);
    let place = 2;
    for (const p of survivors) p.placement = place++;

    this.result = {
      matchId: this.matchId,
      seed: this.blueprint.seed,
      winnerId: winner.id,
      winnerName: winner.username,
      winnerIsBot: winner.isBot,
      time: this.time,
      prize: this.practice ? 0 : pool.prize,
      gross: this.practice ? 0 : pool.gross,
      platformFee: this.practice ? 0 : pool.platformFee,
      participants: [...this.players]
        .sort((a, b) => (a.placement ?? 99) - (b.placement ?? 99))
        .map((p) => ({
          id: p.id,
          username: p.username,
          avatar: p.avatar,
          color: p.color,
          isBot: p.isBot,
          placement: p.placement ?? 10,
          floorsReached: p.maxFloor,
          shoves: p.shoves,
          fallsSurvived: p.fallsSurvived,
          time: p.finishTime ?? p.eliminatedAt ?? this.time,
          creditsWon: this.practice ? 0 : p.id === winner.id ? pool.prize : 0,
        })),
      moments: detectMoments(this.players, this.events),
      timeline: this.events,
    };
  }

  private thinkBots(dt: number): void {
    for (const p of this.players) {
      if (!p.isBot || !p.alive) continue;
      const wait = this.botThink.get(p.id) ?? 0;
      if (wait > 0) {
        this.botThink.set(p.id, wait - dt);
        continue;
      }
      // Weaker bots re-plan less often, which reads as slower reactions.
      this.botThink.set(p.id, 0.16 - p.skill * 0.08 + Math.random() * 0.08);

      let best: WorldPlat | null = null;
      let bestScore = -1e9;
      for (const w of this.world) {
        // Only consider a platform the bot could actually jump to. Scoring the
        // whole tower made every bot sprint at the distant win pad and shove
        // each other off the spawn floor.
        if (!w.enabled) continue;
        // Never target the platform underfoot, or a bot that lands somewhere
        // with no onward hop just stands there for the rest of the match.
        if (w.src.id === p.onId) continue;
        const up = w.y + w.src.sy / 2 - p.y;
        if (up < -3.5 || up > MAX_JUMP_HEIGHT - 0.15) continue;
        const dist = Math.hypot(w.x - p.x, w.z - p.z);
        if (dist > 8) continue;
        const score =
          up * 2.2 -
          dist +
          (w.src.isStep ? 3 : 0) +
          (w.src.isWin ? 40 : 0) -
          (w.src.fake ? 8 * p.skill : 0);
        if (score > bestScore) {
          bestScore = score;
          best = w;
        }
      }

      let ax = 0;
      let az = 0;
      let goalDist = 0;
      if (best) {
        const gx = best.x - p.x;
        const gz = best.z - p.z;
        goalDist = Math.hypot(gx, gz) || 1;
        // Ease off near the goal, otherwise bots overshoot and sprint straight
        // off the far edge of the platform they were aiming for.
        const throttle = Math.min(1, goalDist / 1.8);
        ax = (gx / goalDist) * throttle;
        az = (gz / goalDist) * throttle;
        p.yaw = Math.atan2(gx, gz);
      } else {
        ax = Math.sin(this.time * 0.8 + p.x) * 0.5;
        az = Math.cos(this.time * 0.8 + p.z) * 0.5;
      }

      // Pick a fight with whoever is closest — bots included — rather than
      // dogpiling the one human in the lobby. Weaker bots hold off longer so
      // the whole lobby does not open fire on the same tick.
      let shove = false;
      const armed = COUNTDOWN_SEC + 3 + (1 - p.skill) * 6;
      if (this.time >= armed && p.shoveCd <= 0) {
        let target: TowerPlayerState | null = null;
        let near = SHOVE_RANGE * 0.9;
        for (const o of this.players) {
          if (o.id === p.id || !o.alive) continue;
          if (Math.abs(o.y - p.y) > 2) continue;
          const d = Math.hypot(o.x - p.x, o.z - p.z);
          if (d < near) {
            near = d;
            target = o;
          }
        }
        // Turn and shove, but keep walking the climb route. Chasing rivals made
        // the whole lobby brawl on the spawn floor for the entire match.
        if (target && Math.random() < p.skill * 0.18) {
          p.yaw = Math.atan2(target.x - p.x, target.z - p.z);
          shove = true;
        }
      }

      // Look before you leap: if the ground runs out ahead, either jump the gap
      // toward the goal or pull back from the edge.
      const step = Math.hypot(ax, az);
      if (p.grounded && step > 0.05) {
        const lookX = p.x + (ax / step) * 1.5;
        const lookZ = p.z + (az / step) * 1.5;
        if (!this.groundNear(lookX, lookZ, p.y)) {
          if (best && goalDist > 1.2) p.jumpBuffer = JUMP_BUFFER;
          else {
            ax = -ax * 0.8;
            az = -az * 0.8;
          }
        }
      }

      const climbing = best ? best.y + best.src.sy / 2 > p.y + 0.4 : false;
      if (p.grounded && climbing && goalDist < 6) p.jumpBuffer = JUMP_BUFFER;
      this.inputs.set(p.id, {
        seq: this.tick,
        ax: Math.max(-1, Math.min(1, ax)),
        az: Math.max(-1, Math.min(1, az)),
        jump: false,
        jumpHeld: true,
        shove,
        dodge: false,
        yaw: p.yaw,
      });
    }
  }
}
