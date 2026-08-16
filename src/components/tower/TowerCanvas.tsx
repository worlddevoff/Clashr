import { Canvas, useFrame } from '@react-three/fiber';
import { Billboard, Stars, Text } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { Group, Mesh } from 'three';
import * as THREE from 'three';
import { generateTower } from '../../../shared/tower/generator';
import type { TowerPlayerSnap, TowerSnapshot } from '../../../shared/tower/types';
import { cameraForward, cameraOffset, lineHitsCore, outsideCore } from '../../../shared/tower/camera';
import { FLOOR_COUNT, FLOOR_HEIGHT, TOWER_CORE_RADIUS } from '../../../shared/tower/constants';

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
  showNames,
}: {
  snap: TowerSnapshot;
  humanId: string;
  focusId: string;
  showNames: boolean;
}) {
  const fromRef = useRef(snap);
  const toRef = useRef(snap);
  const t0 = useRef(performance.now());
  const groups = useRef(new Map<string, Group>());

  if (toRef.current.tick !== snap.tick) {
    fromRef.current = toRef.current;
    toRef.current = snap;
    t0.current = performance.now();
  }

  useFrame(() => {
    const span = 50;
    const t = Math.min(1, (performance.now() - t0.current) / span);
    const from = fromRef.current;
    const to = toRef.current;
    for (const p of to.players) {
      const g = groups.current.get(p.id);
      if (!g) continue;
      const prev = from.players.find((x) => x.id === p.id) ?? p;
      g.position.set(lerp(prev.x, p.x, t), lerp(prev.y, p.y, t), lerp(prev.z, p.z, t));
      g.rotation.y = lerp(prev.yaw, p.yaw, t);
    }
  });

  return (
    <>
      {snap.players.map((p) => {
        const fade = p.alive ? 1 : Math.max(0, 1 - p.deadFor / 2.2);
        if (fade <= 0.02) return null;
        return (
          <group
            key={p.id}
            ref={(node) => {
              if (node) groups.current.set(p.id, node);
              else groups.current.delete(p.id);
            }}
            position={[p.x, p.y, p.z]}
            rotation={[0, p.yaw, 0]}
          >
            <group scale={p.alive ? 1 : 0.6 + fade * 0.4}>
              <Bean color={p.color} anim={p.anim} />
            </group>
            {p.alive && p.id === humanId && <SelfMarker />}
            {p.alive && showNames && (
              <Nameplate p={p} you={p.id === humanId} focused={p.id === focusId && p.id !== humanId} />
            )}
          </group>
        );
      })}
    </>
  );
}

/**
 * Chase camera behind and above the climber. Yaw is owned by the player
 * (mouse / Q-E), not the character facing. The lens sits on a spherical
 * orbit that matches `cameraForward`, so WASD always matches the picture.
 */
type FadeRecord = {
  mesh: THREE.Mesh;
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
};

const CORE_KEEP = TOWER_CORE_RADIUS + 1.15;
const LOOK_HEIGHT = 1.15;
const LOOK_AHEAD = 0.7;
const MIN_ARM = 4.2;

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
  const focus = useRef(new THREE.Vector3());
  const desired = useRef(new THREE.Vector3());
  const toCam = useRef(new THREE.Vector3());
  const lastFocus = useRef(focusId);
  const ready = useRef(false);
  const shakeSeed = useRef(Math.random() * 100);
  const ray = useRef(new THREE.Raycaster());
  const faded = useRef<FadeRecord[]>([]);

  useFrame(({ camera, scene }, dt) => {
    const target = snap.players.find((p) => p.id === focusId) ?? snap.players[0];
    if (!target) return;

    let snapLens = !ready.current;
    if (lastFocus.current !== focusId) {
      lastFocus.current = focusId;
      snapLens = true;
      ready.current = false;
    }

    const cinematic = snap.camera === 'final';
    const close = snap.camera === 'fall' || snap.camera === 'ledge';
    const dist = cinematic ? 14 : close ? Math.min(7.2, distRef.current) : distRef.current;
    const yaw = yawRef.current;
    const pitch = pitchRef.current;
    const fwd = cameraForward(yaw);

    // Look a little ahead and above the body so the next platform stays in frame
    // and the player sits in the lower-middle of the screen.
    focus.current.set(
      target.x + fwd.x * LOOK_AHEAD,
      target.y + LOOK_HEIGHT,
      target.z + fwd.z * LOOK_AHEAD,
    );
    if (!ready.current) {
      smoothed.current.copy(focus.current);
      ready.current = true;
    }
    const xyK = close ? 1 - Math.pow(0.0004, dt) : 1 - Math.pow(0.0025, dt);
    const yK = close ? 1 - Math.pow(0.00001, dt) : 1 - Math.pow(0.00008, dt);
    smoothed.current.x = lerp(smoothed.current.x, focus.current.x, xyK);
    smoothed.current.z = lerp(smoothed.current.z, focus.current.z, xyK);
    smoothed.current.y = lerp(smoothed.current.y, focus.current.y, yK);

    const off = cameraOffset(yaw, pitch, dist);
    desired.current.set(
      smoothed.current.x + off.x,
      smoothed.current.y + off.y,
      smoothed.current.z + off.z,
    );

    // Never park the lens inside the column. If the orbit would clip it, lift
    // rather than sliding onto the cylinder (that used to fill the frame).
    const inside = Math.hypot(desired.current.x, desired.current.z) < CORE_KEEP;
    const through = lineHitsCore(
      smoothed.current.x,
      smoothed.current.z,
      desired.current.x,
      desired.current.z,
      TOWER_CORE_RADIUS + 0.35,
    );
    if (inside) {
      const pushed = outsideCore(desired.current.x, desired.current.z, CORE_KEEP);
      desired.current.x = pushed.x;
      desired.current.z = pushed.z;
      desired.current.y = Math.max(desired.current.y, smoothed.current.y + dist * 0.45);
    } else if (through) {
      desired.current.y = Math.max(desired.current.y, smoothed.current.y + Math.max(5.2, dist * 0.62));
    }

    const shake = snap.shake * 0.18;
    if (shake > 0.001) {
      const t = shakeSeed.current + performance.now() / 90;
      desired.current.x += Math.sin(t * 1.7) * shake;
      desired.current.y += Math.cos(t * 2.3) * shake;
    }

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

    toCam.current.copy(desired.current).sub(smoothed.current);
    const span = toCam.current.length();
    if (span > 0.4) {
      toCam.current.multiplyScalar(1 / span);
      ray.current.set(smoothed.current, toCam.current);
      ray.current.far = span - 0.25;
      ray.current.near = 0.4;
      const hits = ray.current.intersectObjects(scene.children, true);
      let nearest = span;
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
          std.opacity = 0.22;
          std.depthWrite = false;
        }
        if (hit.distance < nearest) nearest = hit.distance;
      }
      // Only slide in when a slab is about to swallow the lens — never when
      // that would drop us inside the core.
      if (nearest < MIN_ARM) {
        const keep = Math.max(MIN_ARM, nearest - 0.35);
        desired.current.copy(smoothed.current).addScaledVector(toCam.current, keep);
        if (Math.hypot(desired.current.x, desired.current.z) < CORE_KEEP) {
          desired.current.copy(smoothed.current).addScaledVector(toCam.current, span);
        }
      }
    }

    if (snapLens) camera.position.copy(desired.current);
    else camera.position.lerp(desired.current, 1 - Math.pow(0.00035, dt));
    camera.lookAt(smoothed.current);

    const cam = camera as THREE.PerspectiveCamera;
    if (cam.fov) {
      const want = close ? 48 : cinematic ? 58 : 50;
      cam.fov = lerp(cam.fov, want, 1 - Math.pow(0.02, dt));
      cam.updateProjectionMatrix();
    }
  });
  return null;
}

function TowerCore() {
  const h = FLOOR_COUNT * FLOOR_HEIGHT + 8;
  return (
    <mesh position={[0, h / 2 - 2, 0]} receiveShadow>
      <cylinderGeometry args={[1.05, 1.25, h, 16]} />
      <meshStandardMaterial
        color="#141428"
        emissive="#22e5ff"
        emissiveIntensity={0.22}
        transparent
        opacity={0.42}
        depthWrite={false}
      />
    </mesh>
  );
}

/** Rising kill plane during the collapse phase. */
function CollapsePlane({ y }: { y: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]}>
      <circleGeometry args={[26, 32]} />
      <meshBasicMaterial color="#ff2b2b" transparent opacity={0.16} side={THREE.DoubleSide} />
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
  frameloop = 'always',
  showNames = true,
}: {
  snap: TowerSnapshot;
  humanId: string;
  focusId?: string;
  yawRef: { current: number };
  pitchRef: { current: number };
  distRef: { current: number };
  frameloop?: 'always' | 'demand' | 'never';
  showNames?: boolean;
}) {
  const blueprint = useMemo(() => generateTower(snap.seed), [snap.seed]);
  const moving = useMemo(() => new Map(snap.moving.map((m) => [m.id, m])), [snap.moving]);
  const focus = focusId ?? humanId;

  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        frameloop={frameloop}
        camera={{ position: [0, 9, 12], fov: 50 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
        style={{ filter: snap.slowMo > 0 ? 'saturate(1.2) contrast(1.05)' : undefined }}
      >
        <color attach="background" args={['#070714']} />
        <fog attach="fog" args={['#070714', 34, 110]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[20, 40, 12]} intensity={1.4} castShadow color="#fff4d2" />
        <pointLight position={[0, 40, 0]} intensity={1.2} color="#22e5ff" />
        <pointLight position={[8, 10, -8]} intensity={0.8} color="#ff2b2b" />
        <Stars radius={80} depth={40} count={1200} factor={3} fade />
        <Clouds />
        <TowerCore />
        {blueprint.platforms.map((p) => (
          <PlatformMesh key={p.id} p={p} moving={moving.get(p.id)} />
        ))}
        <Players snap={snap} humanId={humanId} focusId={focus} showNames={showNames} />
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
