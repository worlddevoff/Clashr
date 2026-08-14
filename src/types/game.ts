// Runtime state shapes for the Bomb Party game engine.
import type { GameStatus, PlayerId } from './domain';

export interface Vec2 {
  x: number;
  y: number;
}

export type BotDifficulty = 'easy' | 'normal' | 'hard';

export interface ArenaPlayer {
  id: PlayerId;
  username: string;
  avatar: string;
  color: string;
  isHuman: boolean;
  botDifficulty?: BotDifficulty;
  pos: Vec2;
  vel: Vec2;
  alive: boolean;
  hasBomb: boolean;
  eliminatedAt: number | null; // ms since start
  /** transient reaction shown above the character */
  reaction: string | null;
  reactionUntil: number;
}

export interface BombState {
  holderId: PlayerId;
  timeLeft: number; // seconds
  intensity: number; // 0..1, drives visuals
  passCount: number;
}

/** The shrinking safe zone (battle-royale style), in arena logical coords.
 *  Players outside it are eliminated while `storm` is true. */
export interface SafeZone {
  x: number;
  y: number;
  w: number;
  h: number;
  /** true while the zone is still shrinking */
  closing: boolean;
  /** true from the first shrink until the match ends — outside is lethal */
  storm: boolean;
}

export type HazardKind = 'block' | 'ice';

export interface ArenaHazard {
  id: string;
  kind: HazardKind;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EngineSnapshot {
  status: GameStatus;
  elapsedMs: number;
  players: ArenaPlayer[];
  bomb: BombState | null;
  aliveCount: number;
  lastEliminated: string | null;
  /** screen-shake magnitude in px for the current frame */
  shake: number;
  countdown: number; // pre-game 3..2..1
  winner: ArenaPlayer | null;
  safeZone: SafeZone;
  hazards: ArenaHazard[];
}

export interface EngineConfig {
  arena: { width: number; height: number };
  startTimer: number; // seconds each holder gets when they receive the bomb
  passTimeBonus: number; // never; timer decays continuously
  humanId: PlayerId;
  hazards?: ArenaHazard[];
  /** Pre-game countdown in ms. 0 skips straight to live. Default 3000. */
  countdownMs?: number;
  /** If set, this player starts with the bomb. */
  holderId?: PlayerId;
}
