import type { ModuleKind } from './constants';

export type PlayerAnim =
  | 'idle'
  | 'run'
  | 'jump'
  | 'climb'
  | 'shove'
  | 'hit'
  | 'ragdoll'
  | 'fall'
  | 'ledge'
  | 'victory';

export type MatchPhase = 'countdown' | 'live' | 'final' | 'finished';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface TowerPlatform {
  id: string;
  floor: number;
  kind: ModuleKind;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  rotY: number;
  motion?: PlatformMotion;
  conveyor?: number;
  climbable?: boolean;
  bounce?: number;
  isWin?: boolean;
  isSafety?: boolean;
  /** Generator-inserted stepping stone that guarantees the next floor is reachable. */
  isStep?: boolean;
  fake?: boolean;
  collapseAfter?: number;
}

export type PlatformMotion =
  | { type: 'spin'; speed: number }
  | { type: 'orbit'; radius: number; speed: number; height: number }
  | { type: 'slide'; axis: 'x' | 'z'; amp: number; speed: number }
  | { type: 'elevate'; amp: number; speed: number }
  | { type: 'hammer'; speed: number; length: number }
  | { type: 'beam'; speed: number; length: number };

export interface TowerBlueprint {
  seed: number;
  floors: number;
  platforms: TowerPlatform[];
}

export interface TowerInput {
  seq: number;
  ax: number;
  az: number;
  /** Edge-triggered: consumed by the engine on the tick it fires. */
  jump: boolean;
  /** Level-triggered: releasing before apex cuts the jump short. */
  jumpHeld?: boolean;
  shove: boolean;
  dodge: boolean;
  yaw: number;
}

export interface TowerPlayerState {
  id: string;
  username: string;
  avatar: string;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  alive: boolean;
  grounded: boolean;
  floor: number;
  maxFloor: number;
  anim: PlayerAnim;
  shoveCd: number;
  ragdoll: number;
  ledge: number;
  dodge: number;
  climb: number;
  coyote: number;
  shoves: number;
  fallsSurvived: number;
  lastShovedBy: string | null;
  lastShoveAt: number;
  eliminatedAt: number | null;
  finishTime: number | null;
  placement: number | null;
  onId: string | null;
  jumpBuffer: number;
  /** True while rising from a player-initiated jump (enables variable height). */
  jumping: boolean;
  dodgeCd: number;
  /** Player quit the match rather than being knocked off. */
  forfeited: boolean;
  /** Bot aggression/reaction profile, 0 = passive rookie, 1 = relentless. */
  skill: number;
}

export type TowerEventKind =
  | 'shove'
  | 'shove_ko'
  | 'fall'
  | 'ledge_save'
  | 'elim'
  | 'collapse'
  | 'final'
  | 'win'
  | 'bounce'
  | 'impact';

export interface TowerEvent {
  t: number;
  kind: TowerEventKind;
  actorId?: string;
  targetId?: string;
  floor?: number;
  mag?: number;
  text?: string;
}

export interface TowerPlayerSnap {
  id: string;
  username: string;
  avatar: string;
  color: string;
  isBot: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  alive: boolean;
  floor: number;
  maxFloor: number;
  anim: PlayerAnim;
  shoveCd: number;
  dodgeCd: number;
  grounded: boolean;
  rank: number;
  shoves: number;
  fallsSurvived: number;
  placement: number | null;
  /** Seconds since elimination; the client fades bodies out as they fall away. */
  deadFor: number;
}

export interface MovingSnap {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface TowerSnapshot {
  tick: number;
  time: number;
  phase: MatchPhase;
  seed: number;
  countdown: number;
  collapseY: number;
  aliveCount: number;
  floorCount: number;
  warning: string | null;
  camera: 'follow' | 'fall' | 'ledge' | 'final';
  slowMo: number;
  shake: number;
  players: TowerPlayerSnap[];
  moving: MovingSnap[];
  events: TowerEvent[];
}

export interface TowerMatchResult {
  matchId: string;
  seed: number;
  winnerId: string;
  winnerName: string;
  winnerIsBot: boolean;
  time: number;
  prize: number;
  gross: number;
  platformFee: number;
  participants: TowerParticipantResult[];
  moments: TowerMoment[];
  timeline: TowerEvent[];
}

export interface TowerParticipantResult {
  id: string;
  username: string;
  avatar: string;
  color: string;
  isBot: boolean;
  placement: number;
  floorsReached: number;
  shoves: number;
  fallsSurvived: number;
  time: number;
  creditsWon: number;
}

export interface TowerMoment {
  id: string;
  kind: 'biggest_shove' | 'biggest_fall' | 'last_second_save' | 'final_duel';
  headline: string;
  player: string;
  avatar: string;
  color: string;
  stat: string;
}
