import { Canvas, useFrame } from '@react-three/fiber';
import { Billboard, Stars, Text } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import * as THREE from 'three';
import { generateTower } from '../../../shared/tower/generator';
import type { TowerPlayerSnap, TowerSnapshot } from '../../../shared/tower/types';
import { FLOOR_COUNT, FLOOR_HEIGHT } from '../../../shared/tower/constants';
import { cameraForward, cameraRight, outsideCore } from '../../../shared/tower/camera';

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function PlatformMesh({
  p,
  moving,
}: {
  p: ReturnType<typeof generateTower>['platforms'][number];
  moving?: { x: number; y: number; z: number; rotY: number };
}) {
  const x = moving?.x ?? p.x;
  const y = moving?.y ?? p.y;
  const z = moving?.z ?? p.z;
  const rotY = moving?.rotY ?? p.rotY;
  const color = p.isWin
    ? '#b2ff59'
    : p.fake
      ? '#ff6b6b'
      : p.bounce
        ? '#ffb020'
        : p.climbable
          ? '#a06bff'
          : p.isStep
            ? '#22e5ff'
            : '#3d4cff';
  const emissive = p.isWin ? '#7cff3a' : p.isStep ? '#0e6c80' : '#1a2266';
  return (
    <mesh position={[x, y, z]} rotation={[0, rotY, 0]} castShadow receiveShadow userData={{ occlude: true }}>
      <boxGeometry args={[p.sx, p.sy, p.sz]} />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        emissiveIntensity={p.isWin ? 1.4 : p.isStep ? 0.6 : 0.25}
        metalness={0.35}
        roughness={0.35}
      />
    </mesh>
  );
}

function Bean({ color, anim }: { color: string; anim: string }) {
  const squash = anim === 'shove' ? 1.15 : anim === 'ragdoll' ? 0.85 : anim === 'jump' ? 0.9 : 1;
  const stretch = anim === 'jump' ? 1.2 : anim === 'shove' ? 0.85 : 1;
  return (
    <group scale={[squash, stretch, squash]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.32, 0.55, 6, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.38, 16, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.12, 1.12, 0.3]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
      <mesh position={[0.12, 1.12, 0.3]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

/** Pulsing ring under the player you control so you never lose yourself. */
function SelfMarker() {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.12;
    ref.current.scale.set(s, s, s);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
      <ringGeometry args={[0.5, 0.68, 24]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.75} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Nameplate({ p, you, focused }: { p: TowerPlayerSnap; you: boolean; focused: boolean }) {
  return (
    <Billboard position={[0, 1.95, 0]}>
      <Text
        fontSize={0.32}
        color={you ? '#ffffff' : focused ? '#ffe066' : p.color}
        outlineWidth={0.035}
        outlineColor="#05050f"
        anchorX="center"
        anchorY="middle"
      >
        {you ? 'YOU' : p.username}
      </Text>
    </Billboard>
  );
}

function Players({
  snap,
  humanId,
  focusId,
}: {
  snap: TowerSnapshot;
  humanId: string;
  focusId: string;
}) {
  return (
    <>
      {snap.players.map((p) => {
        // Bodies keep falling after elimination and fade out on the way down.
        const fade = p.alive ? 1 : Math.max(0, 1 - p.deadFor / 2.2);
        if (fade <= 0.02) return null;
        return (
          <group key={p.id} position={[p.x, p.y, p.z]} rotation={[0, p.yaw, 0]}>
            <group scale={p.alive ? 1 : 0.6 + fade * 0.4}>
              <Bean color={p.color} anim={p.anim} />
            </group>
            {p.alive && p.id === humanId && <SelfMarker />}
            {p.alive && (
              <Nameplate p={p} you={p.id === humanId} focused={p.id === focusId && p.id !== humanId} />
            )}
          </group>
        );
      })}
    </>
  );
}

/**
 * Orbit camera. Yaw is owned by the player (mouse / Q-E) rather than derived
 * from the character's facing, so turning while running no longer whips the
 * view around. When the local player is out, `focusId` points at whoever they
 * are spectating.
 */
type FadeRecord = {
  mesh: THREE.Mesh;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
};

function FollowCam({
  snap,
  focusId,
  yawRef,
  pitchRef,
  distRef,
}: {
  snap: TowerSnapshot;
  focusId: string;
  yawRef: { current: number };
  pitchRef: { current: number };
  distRef: { current: number };
}) {
  const smoothed = useRef(new THREE.Vector3());
  const ready = useRef(false);
  const shakeSeed = useRef(Math.random() * 100);
  const ray = useRef(new THREE.Raycaster());
  const faded = useRef<FadeRecord[]>([]);

  useFrame(({ camera, scene }, dt) => {
    const target = snap.players.find((p) => p.id === focusId) ?? snap.players[0];
    if (!target) return;

    const cinematic = snap.camera === 'final';
    const close = snap.camera === 'fall' || snap.camera === 'ledge';
    const dist = cinematic ? 16 : close ? Math.min(8, distRef.current) : distRef.current;
    const yaw = yawRef.current;
    const pitch = pitchRef.current;

    const focus = new THREE.Vector3(target.x, target.y + 1.25, target.z);
    if (!ready.current) {
      smoothed.current.copy(focus);
      ready.current = true;
    }
    // Follow the subject faster vertically than horizontally so long falls stay
    // in frame without the view jittering during normal running.
    const k = 1 - Math.pow(0.0025, dt);
    smoothed.current.x = lerp(smoothed.current.x, focus.x, k);
    smoothed.current.z = lerp(smoothed.current.z, focus.z, k);
    smoothed.current.y = lerp(smoothed.current.y, focus.y, 1 - Math.pow(0.00002, dt));

    // Sit opposite the look direction so the shared camera basis in
    // `shared/tower/camera` matches what the player sees. A slight shoulder
    // offset keeps the core from parking in the middle of the frame.
    const fwd = cameraForward(yaw);
    const right = cameraRight(yaw);
    const shoulder = cinematic ? 0 : 1.35;
    const flat = Math.cos(pitch) * dist;
    const desired = new THREE.Vector3(
      smoothed.current.x - fwd.x * flat + right.x * shoulder,
      smoothed.current.y + Math.sin(pitch) * dist + 1.6,
      smoothed.current.z - fwd.z * flat + right.z * shoulder,
    );

    const clear = outsideCore(desired.x, desired.z, 2.15);
    desired.x = clear.x;
    desired.z = clear.z;

    const shake = snap.shake * 0.25;
    if (shake > 0.001) {
      const t = shakeSeed.current + performance.now() / 90;
      desired.x += Math.sin(t * 1.7) * shake;
      desired.y += Math.cos(t * 2.3) * shake;
    }

    // Ghost anything sitting on the line of sight so a slab or the core never
    // hides the player you are trying to steer.
    for (const rec of faded.current) {
      const mat = rec.mesh.material;
      if (mat && !Array.isArray(mat) && 'opacity' in mat) {
        const std = mat as THREE.MeshStandardMaterial;
        std.opacity = rec.opacity;
        std.transparent = rec.transparent;
        std.depthWrite = rec.depthWrite;
      }
    }
    faded.current = [];

    const toCam = desired.clone().sub(smoothed.current);
    const span = toCam.length();
    if (span > 0.4) {
      toCam.multiplyScalar(1 / span);
      ray.current.set(smoothed.current, toCam);
      ray.current.far = span - 0.35;
      ray.current.near = 0.35;
      const hits = ray.current.intersectObjects(scene.children, true);
      let pulled = span;
      for (const hit of hits) {
        const mesh = hit.object as THREE.Mesh;
        if (!mesh.userData?.occlude) continue;
        const mat = mesh.material;
        if (mat && !Array.isArray(mat) && 'opacity' in mat) {
          const std = mat as THREE.MeshStandardMaterial;
          faded.current.push({
            mesh,
            opacity: std.opacity,
            transparent: std.transparent,
            depthWrite: std.depthWrite,
          });
          std.transparent = true;
          std.opacity = 0.16;
          std.depthWrite = false;
        }
        if (hit.distance < pulled) pulled = hit.distance;
      }
      // If a wall is right in front of the lens, slide in rather than clip.
      if (pulled < span * 0.45) {
        const keep = Math.max(2.4, pulled - 0.4);
        desired.copy(smoothed.current).addScaledVector(toCam, keep);
        const again = outsideCore(desired.x, desired.z, 2.15);
        desired.x = again.x;
        desired.z = again.z;
      }
    }

    camera.position.lerp(desired, 1 - Math.pow(0.0008, dt));
    camera.lookAt(smoothed.current);

    const cam = camera as THREE.PerspectiveCamera;
    if (cam.fov) {
      const want = close ? 46 : cinematic ? 62 : 52;
      cam.fov = lerp(cam.fov, want, 1 - Math.pow(0.02, dt));
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

function TowerCore() {
  const h = FLOOR_COUNT * FLOOR_HEIGHT + 8;
  return (
    <mesh position={[0, h / 2 - 2, 0]} receiveShadow userData={{ occlude: true }}>
      <cylinderGeometry args={[1.05, 1.25, h, 16]} />
      <meshStandardMaterial color="#141428" emissive="#22e5ff" emissiveIntensity={0.12} />
    </mesh>
  );
}

/** Rising kill plane during the collapse phase. */
function CollapsePlane({ y }: { y: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <circleGeometry args={[26, 32]} />
      <meshBasicMaterial color="#ff2ea8" transparent opacity={0.16} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Clouds() {
  const ref = useRef<Group>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02;
  });
  return (
    <group ref={ref} position={[0, -6, 0]}>
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 18, Math.sin(i) * 1.4, Math.cos(a) * 18]}>
            <sphereGeometry args={[3.2 + (i % 3), 10, 10]} />
            <meshStandardMaterial color="#9ad4ff" transparent opacity={0.22} />
          </mesh>
        );
      })}
    </group>
  );
}

export function TowerCanvas({
  snap,
  humanId,
  focusId,
  yawRef,
  pitchRef,
  distRef,
}: {
  snap: TowerSnapshot;
  humanId: string;
  focusId?: string;
  yawRef: { current: number };
  pitchRef: { current: number };
  distRef: { current: number };
}) {
  const blueprint = useMemo(() => generateTower(snap.seed), [snap.seed]);
  const moving = useMemo(() => new Map(snap.moving.map((m) => [m.id, m])), [snap.moving]);
  const focus = focusId ?? humanId;

  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        camera={{ position: [12, 10, 16], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        style={{ filter: snap.slowMo > 0 ? 'saturate(1.2) contrast(1.05)' : undefined }}
      >
        <color attach="background" args={['#070714']} />
        <fog attach="fog" args={['#070714', 34, 110]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[20, 40, 12]} intensity={1.4} castShadow color="#fff4d2" />
        <pointLight position={[0, 40, 0]} intensity={1.2} color="#22e5ff" />
        <pointLight position={[8, 10, -8]} intensity={0.8} color="#ff2ea8" />
        <Stars radius={80} depth={40} count={1200} factor={3} fade />
        <Clouds />
        <TowerCore />
        {blueprint.platforms.map((p) => (
          <PlatformMesh key={p.id} p={p} moving={moving.get(p.id)} />
        ))}
        <Players snap={snap} humanId={humanId} focusId={focus} />
        <FollowCam snap={snap} focusId={focus} yawRef={yawRef} pitchRef={pitchRef} distRef={distRef} />
        {snap.phase === 'final' && <CollapsePlane y={snap.collapseY} />}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
          <circleGeometry args={[40, 24]} />
          <meshStandardMaterial color="#0a1028" />
        </mesh>
      </Canvas>
    </div>
  );
}
