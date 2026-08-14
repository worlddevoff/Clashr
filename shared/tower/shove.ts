import { SHOVE_CONE_DOT, SHOVE_IMPULSE, SHOVE_RANGE } from './constants';
import type { TowerPlayerState } from './types';

export interface ShoveResult {
  applied: boolean;
  impulse: number;
  dx: number;
  dz: number;
  ragdoll: boolean;
  nearEdge: boolean;
}

export function facingDot(
  attacker: Pick<TowerPlayerState, 'x' | 'z' | 'yaw'>,
  target: Pick<TowerPlayerState, 'x' | 'z'>,
): number {
  const fx = Math.sin(attacker.yaw);
  const fz = Math.cos(attacker.yaw);
  let dx = target.x - attacker.x;
  let dz = target.z - attacker.z;
  const len = Math.hypot(dx, dz) || 1;
  dx /= len;
  dz /= len;
  return fx * dx + fz * dz;
}

export function computeShove(
  attacker: TowerPlayerState,
  target: TowerPlayerState,
  nearEdge: boolean,
): ShoveResult {
  const dist = Math.hypot(target.x - attacker.x, target.z - attacker.z);
  if (dist > SHOVE_RANGE || dist < 0.05) {
    return { applied: false, impulse: 0, dx: 0, dz: 0, ragdoll: false, nearEdge };
  }
  const dot = facingDot(attacker, target);
  if (dot < SHOVE_CONE_DOT) {
    return { applied: false, impulse: 0, dx: 0, dz: 0, ragdoll: false, nearEdge };
  }
  const speed = Math.hypot(attacker.vx, attacker.vz);
  const groundedFactor = target.grounded ? 1 : 1.25;
  const edgeFactor = nearEdge ? 1.2 : 1;
  const distFactor = 1.1 - (dist / SHOVE_RANGE) * 0.25;
  const impulse = SHOVE_IMPULSE * (1 + speed * 0.02) * groundedFactor * edgeFactor * distFactor;
  const dx = (target.x - attacker.x) / dist;
  const dz = (target.z - attacker.z) / dist;
  return {
    applied: true,
    impulse,
    dx,
    dz,
    // Edge hits always ragdoll — that is the dramatic knock-off. A bump in the
    // middle of a platform leaves the target in control.
    ragdoll: nearEdge || impulse > 9,
    nearEdge,
  };
}
