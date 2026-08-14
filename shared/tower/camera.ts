/**
 * Shared camera basis for Tower.
 *
 * The follow camera orbits the subject at `yaw` and sits at
 * `subject + (sin(yaw + PI), cos(yaw + PI)) * distance`, so it looks along
 * `(sin yaw, cos yaw)`. Player input is expressed in this basis: pushing
 * forward always moves away from the viewer regardless of which way the
 * character happens to be facing.
 */

export interface PlanarVec {
  x: number;
  z: number;
}

/** Direction the camera looks, projected onto the ground plane. */
export function cameraForward(yaw: number): PlanarVec {
  return { x: Math.sin(yaw), z: Math.cos(yaw) };
}

/** Screen-right on the ground plane: cross(forward, worldUp) in a Y-up right-handed space. */
export function cameraRight(yaw: number): PlanarVec {
  return { x: -Math.cos(yaw), z: Math.sin(yaw) };
}

/**
 * Convert stick/WASD input into a world-space direction.
 * `strafe` is +1 for right, `forward` is +1 for away from the camera.
 */
export function moveFromCamera(yaw: number, strafe: number, forward: number): PlanarVec {
  const f = cameraForward(yaw);
  const r = cameraRight(yaw);
  let x = f.x * forward + r.x * strafe;
  let z = f.z * forward + r.z * strafe;
  const mag = Math.hypot(x, z);
  if (mag > 1) {
    x /= mag;
    z /= mag;
  }
  return { x, z };
}

/**
 * Keep the camera from sitting inside the tower core. A follow cam that
 * orbits through the column makes the whole structure fill the frame.
 */
export function outsideCore(x: number, z: number, radius: number): PlanarVec {
  const r = Math.hypot(x, z);
  if (r >= radius) return { x, z };
  const s = radius / Math.max(r, 1e-4);
  return { x: x * s, z: z * s };
}
