// Bomb Party — authoritative simulation.
//
// Rules: one player holds a ticking bomb. The fuse starts generous and
// tightens as the arena shrinks. The holder chases another player to pass it
// (bump = pass). When the timer hits zero the holder explodes. Last standing
// wins. After the grace period the safe zone shrinks and stays lethal.
import { GameEngine } from './GameEngine';
import { buildArenaHazards } from './arenaHazards';
import type {
  ArenaHazard,
  ArenaPlayer,
  BombState,
  BotDifficulty,
  EngineConfig,
  EngineSnapshot,
  Vec2,
} from '../types/game';
import type { GameStatus } from '../types/domain';

// Matches the 48px sprite (h-12 w-12), slightly inside rounded corners so
// you only stop when the body actually overlaps a block.
const PLAYER_RADIUS = 22;
const PASS_RADIUS = 54;
/** Tailwind `rounded-xl` on arena blocks — collision must match the visual. */
const BLOCK_CORNER_RADIUS = 12;
const PASS_COOLDOWN_MS = 550;
const BASE_SPEED = 190; // px/s
const CARRIER_SPEED = 232; // holder runs a touch faster (desperation)
const REACTIONS = ['😱', '🥵', '😭', '🤪', '💀', '🙈', '😤'];

/** Emojis the human can taunt with (number keys 1-6 + the on-screen bar). */
export const TAUNTS = ['😂', '😎', '👋', '🤡', '🔥', '💀'];

/** Every holder gets the same readable fuse, including two-player endgames. */
const HOLD_SECONDS = 12;

export const ZONE_GRACE_MS = 6000;
export const ZONE_CLOSE_MS = 42000;
export const ZONE_MIN_FRACTION = 0.26;
const ZONE_ELIM_MARGIN = PLAYER_RADIUS * 0.4;

export function computeSafeZone(
  elapsedMs: number,
  status: GameStatus,
  arena: { width: number; height: number },
) {
  const raw = (elapsedMs - ZONE_GRACE_MS) / ZONE_CLOSE_MS;
  const t = Math.max(0, Math.min(1, raw));
  const eased = t * t;
  const w = arena.width * (1 - (1 - ZONE_MIN_FRACTION) * eased);
  const h = arena.height * (1 - (1 - ZONE_MIN_FRACTION) * eased);
  const live = status === 'live';
  const started = live && elapsedMs > ZONE_GRACE_MS;
  return {
    x: (arena.width - w) / 2,
    y: (arena.height - h) / 2,
    w,
    h,
    closing: started && t < 1,
    storm: started,
  };
}

const DIFF_CYCLE: BotDifficulty[] = ['easy', 'normal', 'hard', 'normal', 'hard', 'easy'];

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pointInRect(px: number, py: number, h: ArenaHazard): boolean {
  return px >= h.x && px <= h.x + h.w && py >= h.y && py <= h.y + h.h;
}

function circleHitsBlock(cx: number, cy: number, r: number, b: ArenaHazard): boolean {
  const corner = Math.min(BLOCK_CORNER_RADIUS, b.w / 2, b.h / 2);
  // Rounded rect = inner AABB dilated by `corner`. Circle hits iff center is
  // within that inner AABB dilated by (corner + r).
  const ix = b.x + corner;
  const iy = b.y + corner;
  const iw = b.w - 2 * corner;
  const ih = b.h - 2 * corner;
  const nearestX = Math.max(ix, Math.min(cx, ix + iw));
  const nearestY = Math.max(iy, Math.min(cy, iy + ih));
  return Math.hypot(cx - nearestX, cy - nearestY) < corner + r;
}

export interface BombPartySeedPlayer {
  id: string;
  username: string;
  avatar: string;
  color: string;
  isHuman: boolean;
}

export class BombPartyEngine extends GameEngine {
  readonly id = 'bomb-party';
  private cfg: EngineConfig;
  private players: ArenaPlayer[] = [];
  private bomb: BombState | null = null;
  private status: GameStatus = 'countdown';
  private elapsed = 0;
  private countdownMs = 3000;
  private shake = 0;
  private lastPassAt = 0;
  private lastEliminated: string | null = null;
  private inputs = new Map<string, { up: boolean; down: boolean; left: boolean; right: boolean }>();
  private targets = new Map<string, Vec2 | null>();
  private onExplosion?: () => void;
  private hazards: ArenaHazard[];

  constructor(seed: BombPartySeedPlayer[], cfg: EngineConfig) {
    super();
    this.cfg = cfg;
    this.hazards = cfg.hazards?.length ? cfg.hazards : buildArenaHazards(cfg.arena.width, cfg.arena.height);
    this.players = seed.map((s, i) => this.spawn(s, i, seed.length));
    this.countdownMs = cfg.countdownMs ?? 3000;
    if (this.countdownMs <= 0) this.status = 'live';
    for (const p of this.players) {
      if (p.isHuman) {
        this.inputs.set(p.id, { up: false, down: false, left: false, right: false });
        this.targets.set(p.id, null);
      }
    }
    const first =
      this.players.find((p) => p.id === cfg.holderId) ??
      this.players[Math.floor(Math.random() * this.players.length)];
    first.hasBomb = true;
    this.bomb = { holderId: first.id, timeLeft: this.holdSeconds(), intensity: 0, passCount: 0 };
  }

  setExplosionCallback(fn: () => void) {
    this.onExplosion = fn;
  }

  private spawn(s: BombPartySeedPlayer, i: number, n: number): ArenaPlayer {
    const { width, height } = this.cfg.arena;
    const angle = (i / n) * Math.PI * 2;
    const r = Math.min(width, height) * 0.34;
    return {
      id: s.id,
      username: s.username,
      avatar: s.avatar,
      color: s.color,
      isHuman: s.isHuman,
      botDifficulty: s.isHuman ? undefined : DIFF_CYCLE[i % DIFF_CYCLE.length],
      pos: { x: width / 2 + Math.cos(angle) * r, y: height / 2 + Math.sin(angle) * r },
      vel: { x: 0, y: 0 },
      alive: true,
      hasBomb: false,
      eliminatedAt: null,
      reaction: null,
      reactionUntil: 0,
    };
  }

  setKey(playerId: string, dir: 'up' | 'down' | 'left' | 'right', pressed: boolean) {
    const input = this.inputs.get(playerId);
    if (!input) return;
    input[dir] = pressed;
    if (pressed) this.targets.set(playerId, null);
  }

  setLocalKey(dir: 'up' | 'down' | 'left' | 'right', pressed: boolean) {
    this.setKey(this.cfg.humanId, dir, pressed);
  }

  setMoveTarget(playerId: string, t: Vec2 | null) {
    if (!this.inputs.has(playerId)) return;
    this.targets.set(playerId, t);
  }

  setLocalMoveTarget(t: Vec2 | null) {
    this.setMoveTarget(this.cfg.humanId, t);
  }

  taunt(playerId: string, emoji: string) {
    const me = this.players.find((p) => p.id === playerId && p.alive);
    if (!me) return;
    me.reaction = emoji;
    me.reactionUntil = this.elapsed + 1600;
  }

  tauntLocal(emoji: string) {
    this.taunt(this.cfg.humanId, emoji);
  }

  private react(p: ArenaPlayer) {
    p.reaction = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];
    p.reactionUntil = this.elapsed + 1200;
  }

  private holdSeconds(): number {
    return this.cfg.startTimer > 0 ? this.cfg.startTimer : HOLD_SECONDS;
  }

  private onIce(p: ArenaPlayer): boolean {
    return this.hazards.some((h) => h.kind === 'ice' && pointInRect(p.pos.x, p.pos.y, h));
  }

  private resolveBlocks(p: ArenaPlayer, prev: Vec2) {
    for (const h of this.hazards) {
      if (h.kind !== 'block') continue;
      if (!circleHitsBlock(p.pos.x, p.pos.y, PLAYER_RADIUS, h)) continue;
      // try axis-separated slides
      const tryX = { x: p.pos.x, y: prev.y };
      const tryY = { x: prev.x, y: p.pos.y };
      if (!circleHitsBlock(tryX.x, tryX.y, PLAYER_RADIUS, h)) {
        p.pos.y = prev.y;
      } else if (!circleHitsBlock(tryY.x, tryY.y, PLAYER_RADIUS, h)) {
        p.pos.x = prev.x;
      } else {
        p.pos.x = prev.x;
        p.pos.y = prev.y;
      }
    }
  }

  step(dtMs: number): void {
    const dt = dtMs / 1000;

    if (this.status === 'countdown') {
      this.countdownMs -= dtMs;
      if (this.countdownMs <= 0) this.status = 'live';
      this.shake *= 0.85;
      return;
    }
    if (this.status === 'finished') {
      this.shake *= 0.85;
      return;
    }

    this.elapsed += dtMs;
    this.shake *= 0.82;

    const alive = this.players.filter((p) => p.alive);
    const holder = this.players.find((p) => p.id === this.bomb?.holderId && p.alive);

    for (const p of alive) {
      const icy = this.onIce(p);
      const speedMul = icy ? 1.28 : 1;
      const speed = (p.hasBomb ? CARRIER_SPEED : BASE_SPEED) * speedMul;
      let dx = 0;
      let dy = 0;

      if (p.isHuman) {
        const input = this.inputs.get(p.id) ?? { up: false, down: false, left: false, right: false };
        const target = this.targets.get(p.id) ?? null;
        dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
        if (dx === 0 && dy === 0 && target) {
          const to = { x: target.x - p.pos.x, y: target.y - p.pos.y };
          const d = Math.hypot(to.x, to.y);
          if (d > 6) {
            dx = to.x;
            dy = to.y;
          } else {
            this.targets.set(p.id, null);
          }
        }
      } else {
        this.bot(p, holder, alive, dt);
        dx = p.vel.x;
        dy = p.vel.y;
      }

      const mag = Math.hypot(dx, dy);
      const prev = { x: p.pos.x, y: p.pos.y };
      if (mag > 0.001) {
        const nx = dx / mag;
        const ny = dy / mag;
        // ice: blend toward desired heading (slippery)
        if (icy && !p.isHuman) {
          p.vel.x = p.vel.x * 0.88 + nx * 0.12;
          p.vel.y = p.vel.y * 0.88 + ny * 0.12;
          const vm = Math.hypot(p.vel.x, p.vel.y) || 1;
          p.pos.x += (p.vel.x / vm) * speed * dt;
          p.pos.y += (p.vel.y / vm) * speed * dt;
        } else if (icy && p.isHuman) {
          p.vel.x = p.vel.x * 0.82 + nx * 0.18;
          p.vel.y = p.vel.y * 0.82 + ny * 0.18;
          const vm = Math.hypot(p.vel.x, p.vel.y) || 1;
          p.pos.x += (p.vel.x / vm) * speed * dt;
          p.pos.y += (p.vel.y / vm) * speed * dt;
        } else {
          p.vel = { x: nx, y: ny };
          p.pos.x += nx * speed * dt;
          p.pos.y += ny * speed * dt;
        }
      } else if (!icy) {
        p.vel = { x: 0, y: 0 };
      } else {
        // coast on ice
        const vm = Math.hypot(p.vel.x, p.vel.y);
        if (vm > 0.05) {
          p.pos.x += (p.vel.x / vm) * speed * 0.7 * dt;
          p.pos.y += (p.vel.y / vm) * speed * 0.7 * dt;
          p.vel.x *= 0.97;
          p.vel.y *= 0.97;
        }
      }

      p.pos.x = Math.max(PLAYER_RADIUS, Math.min(this.cfg.arena.width - PLAYER_RADIUS, p.pos.x));
      p.pos.y = Math.max(PLAYER_RADIUS, Math.min(this.cfg.arena.height - PLAYER_RADIUS, p.pos.y));
      this.resolveBlocks(p, prev);

      // Once the storm has finished shrinking, the blue box IS the arena.
      // Walking the darkened ring after that was a bug: `closing` flipped
      // off at t=1 and both the kill check and the bot "stay inside" pull
      // stopped, so matches kept going in the void.
      const zone = this.computeZone();
      if (zone.storm && !zone.closing) {
        p.pos.x = Math.max(zone.x + PLAYER_RADIUS, Math.min(zone.x + zone.w - PLAYER_RADIUS, p.pos.x));
        p.pos.y = Math.max(zone.y + PLAYER_RADIUS, Math.min(zone.y + zone.h - PLAYER_RADIUS, p.pos.y));
      }

      if (p.reaction && this.elapsed > p.reactionUntil) p.reaction = null;
    }

    if (this.bomb && holder) {
      const hold = this.holdSeconds();
      this.bomb.timeLeft -= dt;
      this.bomb.intensity = Math.max(0, Math.min(1, 1 - this.bomb.timeLeft / hold));

      if (this.elapsed - this.lastPassAt > PASS_COOLDOWN_MS) {
        for (const p of alive) {
          if (p.id === holder.id) continue;
          if (dist(p.pos, holder.pos) < PASS_RADIUS) {
            holder.hasBomb = false;
            p.hasBomb = true;
            this.bomb.holderId = p.id;
            this.bomb.passCount += 1;
            this.bomb.timeLeft = hold;
            this.bomb.intensity = 0;
            this.lastPassAt = this.elapsed;
            this.shake = 8;
            this.react(p);
            break;
          }
        }
      }

      if (this.bomb.timeLeft <= 0) {
        holder.alive = false;
        holder.hasBomb = false;
        holder.eliminatedAt = this.elapsed;
        this.lastEliminated = holder.username;
        this.shake = 26;
        this.onExplosion?.();

        const remaining = this.players.filter((p) => p.alive);
        if (remaining.length <= 1) {
          this.status = 'finished';
          this.bomb = null;
        } else {
          const next = remaining[Math.floor(Math.random() * remaining.length)];
          next.hasBomb = true;
          this.bomb = {
            holderId: next.id,
            timeLeft: hold,
            intensity: 0,
            passCount: this.bomb.passCount + 1,
          };
          this.react(next);
        }
      }
    }

    const zone = this.computeZone();
    if (zone.storm) {
      for (const p of this.players) {
        if (!p.alive) continue;
        const outside =
          p.pos.x < zone.x - ZONE_ELIM_MARGIN ||
          p.pos.x > zone.x + zone.w + ZONE_ELIM_MARGIN ||
          p.pos.y < zone.y - ZONE_ELIM_MARGIN ||
          p.pos.y > zone.y + zone.h + ZONE_ELIM_MARGIN;
        if (outside) {
          p.alive = false;
          p.eliminatedAt = this.elapsed;
          this.lastEliminated = p.username;
          this.shake = Math.max(this.shake, 18);
          this.onExplosion?.();
          if (this.bomb && this.bomb.holderId === p.id) {
            p.hasBomb = false;
            const survivors = this.players.filter((s) => s.alive);
            if (survivors.length > 0) {
              const next = survivors[Math.floor(Math.random() * survivors.length)];
              next.hasBomb = true;
              this.bomb = {
                ...this.bomb,
                holderId: next.id,
                timeLeft: this.holdSeconds(),
                intensity: 0,
              };
              this.react(next);
            }
          }
        }
      }
      const remaining = this.players.filter((p) => p.alive);
      if (remaining.length <= 1 && this.status === 'live') {
        this.status = 'finished';
        this.bomb = null;
      }
    }
  }

  private computeZone() {
    return computeSafeZone(this.elapsed, this.status, this.cfg.arena);
  }

  private bot(p: ArenaPlayer, holder: ArenaPlayer | undefined, alive: ArenaPlayer[], dt: number) {
    if (!holder) return;
    const diff = p.botDifficulty ?? 'normal';
    const steer =
      diff === 'easy' ? 4.5 : diff === 'hard' ? 14 : 8;
    const wander =
      diff === 'easy' ? 110 : diff === 'hard' ? 28 : 60;
    const zonePull =
      diff === 'easy' ? 0.9 : diff === 'hard' ? 2.4 : 1.6;
    const predict =
      diff === 'hard' ? 0.28 : diff === 'normal' ? 0.12 : 0;

    let want: Vec2;
    if (p.hasBomb) {
      const others = alive.filter((o) => o.id !== p.id);
      let nearest = others[0];
      let best = Infinity;
      for (const o of others) {
        const d = dist(o.pos, p.pos);
        if (d < best) {
          best = d;
          nearest = o;
        }
      }
      if (nearest) {
        const tx = nearest.pos.x + nearest.vel.x * 80 * predict;
        const ty = nearest.pos.y + nearest.vel.y * 80 * predict;
        want = { x: tx - p.pos.x, y: ty - p.pos.y };
        // hard bots cut angles toward predicted pass
        if (diff === 'hard') {
          want.x += (Math.random() - 0.5) * 10;
          want.y += (Math.random() - 0.5) * 10;
        }
      } else {
        want = { x: 0, y: 0 };
      }
      // easy carriers hesitate / wander more
      if (diff === 'easy') {
        want.x += (Math.random() - 0.5) * 80;
        want.y += (Math.random() - 0.5) * 80;
      }
    } else {
      const hx = holder.pos.x + holder.vel.x * 60 * predict;
      const hy = holder.pos.y + holder.vel.y * 60 * predict;
      want = { x: p.pos.x - hx, y: p.pos.y - hy };
      want.x += (Math.random() - 0.5) * wander;
      want.y += (Math.random() - 0.5) * wander;
      const m = diff === 'hard' ? 110 : 90;
      if (p.pos.x < m) want.x += 40;
      if (p.pos.x > this.cfg.arena.width - m) want.x -= 40;
      if (p.pos.y < m) want.y += 40;
      if (p.pos.y > this.cfg.arena.height - m) want.y -= 40;

      // hard: dodge toward open space away from blocks when fleeing
      if (diff === 'hard') {
        for (const h of this.hazards) {
          if (h.kind !== 'block') continue;
          const bx = h.x + h.w / 2;
          const by = h.y + h.h / 2;
          const d = Math.hypot(p.pos.x - bx, p.pos.y - by);
          if (d < 120) {
            want.x += (p.pos.x - bx) * 0.8;
            want.y += (p.pos.y - by) * 0.8;
          }
        }
      }
    }

    const zone = this.computeZone();
    if (zone.storm) {
      const buffer = PLAYER_RADIUS * (diff === 'hard' ? 2.8 : 2.2);
      const cx = zone.x + zone.w / 2;
      const cy = zone.y + zone.h / 2;
      const nearEdge =
        p.pos.x < zone.x + buffer ||
        p.pos.x > zone.x + zone.w - buffer ||
        p.pos.y < zone.y + buffer ||
        p.pos.y > zone.y + zone.h - buffer;
      if (nearEdge) {
        want.x += (cx - p.pos.x) * zonePull;
        want.y += (cy - p.pos.y) * zonePull;
      }
    }

    const d = Math.hypot(want.x, want.y) || 1;
    p.vel.x += (want.x / d - p.vel.x) * Math.min(1, dt * steer);
    p.vel.y += (want.y / d - p.vel.y) * Math.min(1, dt * steer);
  }

  snapshot(): EngineSnapshot {
    const alive = this.players.filter((p) => p.alive);
    const winner = this.status === 'finished' ? alive[0] ?? null : null;
    return {
      status: this.status,
      elapsedMs: this.elapsed,
      players: this.players.map((p) => ({ ...p, pos: { ...p.pos }, vel: { ...p.vel } })),
      bomb: this.bomb ? { ...this.bomb } : null,
      aliveCount: alive.length,
      lastEliminated: this.lastEliminated,
      shake: this.shake,
      countdown: Math.max(0, Math.ceil(this.countdownMs / 1000)),
      winner,
      safeZone: this.computeZone(),
      hazards: this.hazards,
      mapId: this.cfg.mapId ?? 'neon-nexus',
    };
  }

  getElapsedSec(): number {
    return this.elapsed / 1000;
  }
  getConfig(): EngineConfig {
    return this.cfg;
  }
  /** Fuse a newly received bomb starts with. Used by tests. */
  getHoldSeconds(): number {
    return this.holdSeconds();
  }

  finished(): boolean {
    return this.status === 'finished';
  }

  winnerId(): string | null {
    if (this.status !== 'finished') return null;
    return this.players.find((p) => p.alive)?.id ?? null;
  }

  forfeit(playerId: string): void {
    const p = this.players.find((pl) => pl.id === playerId);
    if (!p || !p.alive || this.status === 'finished') return;
    p.alive = false;
    p.hasBomb = false;
    p.eliminatedAt = this.elapsed;
    this.lastEliminated = p.username;
    if (this.bomb && this.bomb.holderId === p.id) {
      const survivors = this.players.filter((s) => s.alive);
      if (survivors.length > 0) {
        const next = survivors[Math.floor(Math.random() * survivors.length)];
        next.hasBomb = true;
        this.bomb = {
          ...this.bomb,
          holderId: next.id,
          timeLeft: this.holdSeconds(),
          intensity: 0,
        };
      } else {
        this.bomb = null;
      }
    }
    if (this.players.filter((s) => s.alive).length <= 1) {
      this.status = 'finished';
      this.bomb = null;
    }
  }

  /** Test helper: jump the clock without simulating the intervening frames. */
  debugSetElapsed(ms: number) {
    this.elapsed = ms;
  }

  /** Test helper: place a player in arena space. */
  debugSetPos(id: string, x: number, y: number) {
    const p = this.players.find((pl) => pl.id === id);
    if (!p) return;
    p.pos = { x, y };
  }
}
