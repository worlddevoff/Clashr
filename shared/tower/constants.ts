export const FLOOR_COUNT = 30;
export const FLOOR_HEIGHT = 5.6;
/**
 * Largest vertical gap the generator is allowed to leave between two platforms
 * a player must jump between. Must stay comfortably under the peak jump height
 * (JUMP_SPEED^2 / 2 / GRAVITY) or floors become impossible to climb.
 */
export const FLOOR_STEP_GAP = 2.7;
export const TOWER_CORE_RADIUS = 1.15;
export const PLAYER_RADIUS = 0.42;
export const PLAYER_HEIGHT = 1.55;
export const MOVE_SPEED = 9;
export const AIR_CONTROL = 0.72;
/** Rising gravity. Falling uses GRAVITY * FALL_GRAVITY_MULT for a snappier arc. */
export const GRAVITY = 26;
export const FALL_GRAVITY_MULT = 1.55;
/** Peak jump height is JUMP_SPEED^2 / (2 * GRAVITY) — keep above FLOOR_STEP_GAP. */
export const JUMP_SPEED = 13.2;
/** Velocity kept when the jump key is released before apex (variable jump height). */
export const JUMP_CUT = 0.42;
/** Jump presses within this window before landing still fire on touchdown. */
export const JUMP_BUFFER = 0.14;
export const COYOTE_TIME = 0.16;
/** Seconds to reach target ground speed (lower = snappier). */
export const GROUND_ACCEL_TIME = 0.09;
export const GROUND_FRICTION_TIME = 0.07;
/** Airborne coasting is slow to bleed off, so jumps keep their momentum. */
export const AIR_DRAG_TIME = 1.1;
/** How fast knockback decays while ragdolled — without it a shove is a one-way ticket off the tower. */
export const RAGDOLL_DRAG_TIME = 0.5;
export const SHOVE_RANGE = 2.15;
export const SHOVE_CONE_DOT = 0.28;
export const SHOVE_COOLDOWN = 0.85;
/**
 * Applied as a direct velocity change, so this is measured against MOVE_SPEED.
 * The old 13.5 stacked with the airborne/edge multipliers into ~28, which flung
 * players clean off the tower from anywhere on a floor. Tuned so a shove is
 * deadly near a ledge and recoverable from the middle of a platform.
 */
export const SHOVE_IMPULSE = 6.5;
export const RAGDOLL_TIME = 0.72;
export const LEDGE_GRAB_WINDOW = 0.9;
export const DODGE_SPEED = 14;
export const DODGE_TIME = 0.22;
export const DODGE_COOLDOWN = 0.7;
export const CLIMB_SPEED = 3.6;
/** Caps fall speed so long drops stay readable and collision stays swept-safe. */
export const TERMINAL_VELOCITY = 38;
/** Peak height of a full-hold jump. Level generation and bot pathing key off this. */
export const MAX_JUMP_HEIGHT = (JUMP_SPEED * JUMP_SPEED) / (2 * GRAVITY);
export const TICK_HZ = 60;
export const SNAPSHOT_EVERY = 3;
export const FINAL_ALIVE_THRESHOLD = 3;
export const MATCH_TIME_LIMIT = 180;
export const COUNTDOWN_SEC = 3;
/**
 * The collapse is paced to reach the summit exactly as the clock runs out, so
 * the rate is derived per match rather than fixed. A flat 7.2 swept the whole
 * 168-unit tower in 25 seconds, which meant every match ended in collapse
 * attrition around 155s and nobody ever reached the win pad. This is only the
 * floor: a collapse that starts early still has to feel like a squeeze.
 */
export const COLLAPSE_SPEED_MIN = 2.6;
/** Fraction of the match clock after which the tower starts collapsing regardless. */
export const FINAL_PHASE_AT = 0.72;
/** Reaching this floor triggers the endgame early. */
export const FINAL_TRIGGER_FLOOR = FLOOR_COUNT - 9;
export const QUEUE_BACKFILL_MS = 3500;
export const RECONNECT_GRACE_MS = 12000;
export const INPUT_RATE_HZ = 30;

export const BANDS = [
  { from: 1, to: 5, label: 'tutorial' },
  { from: 6, to: 10, label: 'movers' },
  { from: 11, to: 15, label: 'pvp' },
  { from: 16, to: 20, label: 'narrow' },
  { from: 21, to: 25, label: 'hard' },
  { from: 26, to: 30, label: 'endgame' },
] as const;

export type ModuleKind =
  | 'tutorial_wide'
  | 'rotating'
  | 'hammer'
  | 'movers'
  | 'collapse'
  | 'bridge'
  | 'conveyor'
  | 'spinning_beam'
  | 'wall_jump'
  | 'elevator'
  | 'fake_shortcut'
  | 'bounce'
  | 'trap_lane'
  | 'choke'
  | 'final_climb';

export const MODULE_BY_BAND: Record<string, ModuleKind[]> = {
  tutorial: ['tutorial_wide', 'bounce', 'bridge', 'tutorial_wide'],
  movers: ['movers', 'conveyor', 'rotating', 'elevator'],
  pvp: ['choke', 'hammer', 'bridge', 'conveyor'],
  narrow: ['collapse', 'spinning_beam', 'fake_shortcut', 'bridge'],
  hard: ['wall_jump', 'elevator', 'trap_lane', 'hammer'],
  endgame: ['spinning_beam', 'collapse', 'choke', 'final_climb'],
};
