import { useEffect, useRef, useState } from 'react';
import { TowerCanvas } from '../tower/TowerCanvas';
import { TowerEngine } from '../../../shared/tower/engine';
import { outwardLookYaw } from '../../../shared/tower/camera';
import { TOWER_BOT_AVATARS, TOWER_BOT_COLORS, TOWER_BOT_NAMES } from '../../../shared/tower/bots';
import { COUNTDOWN_SEC } from '../../../shared/tower/constants';
import type { TowerFighter } from '../../../shared/tower/engine';
import type { TowerSnapshot } from '../../../shared/tower/types';

const FIGHTERS: TowerFighter[] = TOWER_BOT_NAMES.slice(0, 8).map((name, i) => ({
  id: `lineup-tower-${i}`,
  username: name,
  avatar: TOWER_BOT_AVATARS[i % TOWER_BOT_AVATARS.length],
  color: TOWER_BOT_COLORS[i % TOWER_BOT_COLORS.length],
  isBot: true,
}));

const RESTART_MS = 1800;

function lerpAngle(a: number, b: number, t: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export default function LineupTowerPreview() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);
  const yawRef = useRef(Math.PI);
  const pitchRef = useRef(0.46);
  const distRef = useRef(11.5);
  const [round, setRound] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [snap, setSnap] = useState<TowerSnapshot | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const engine = new TowerEngine({
      seed: Math.floor(Math.random() * 1e9),
      matchId: `lineup-tower-${round}`,
      fighters: FIGHTERS,
      practice: true,
    });
    for (let t = 0; t < COUNTDOWN_SEC * 1000 + 80; t += 50) engine.step(50);
    const opening = engine.snapshot();
    const opener = [...opening.players].filter((p) => p.alive).sort((a, b) => a.rank - b.rank)[0];
    if (opener) yawRef.current = outwardLookYaw(opener.x, opener.z);
    setSnap(opening);

    let raf = 0;
    let restart: number | null = null;
    let last = performance.now();

    const loop = (t: number) => {
      const dt = Math.min(48, t - last);
      last = t;
      engine.step(dt);
      const next = engine.snapshot();
      const leader = [...next.players].filter((p) => p.alive).sort((a, b) => a.rank - b.rank)[0];
      if (leader) {
        yawRef.current = lerpAngle(yawRef.current, outwardLookYaw(leader.x, leader.z), 0.045);
      }
      setSnap(next);
      if (engine.finished) {
        restart = window.setTimeout(() => setRound((r) => r + 1), RESTART_MS);
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const sync = () => {
      const play =
        !reduce && document.visibilityState === 'visible' && visibleRef.current && !engine.finished;
      setPlaying(play);
      if (play && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      } else if (!play && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const root = wrapRef.current;
    const io = root
      ? new IntersectionObserver(
          ([entry]) => {
            visibleRef.current = entry.isIntersecting;
            sync();
          },
          { threshold: 0.15 },
        )
      : null;
    if (root && io) io.observe(root);
    document.addEventListener('visibilitychange', sync);
    sync();

    return () => {
      if (restart != null) window.clearTimeout(restart);
      if (raf) cancelAnimationFrame(raf);
      io?.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [round]);

  const focusId = snap
    ? ([...snap.players].filter((p) => p.alive).sort((a, b) => a.rank - b.rank)[0]?.id ?? snap.players[0]?.id)
    : '';

  return (
    <div ref={wrapRef} className="h-full w-full bg-ink-900" aria-hidden>
      {snap ? (
        <TowerCanvas
          snap={snap}
          humanId=""
          focusId={focusId}
          yawRef={yawRef}
          pitchRef={pitchRef}
          distRef={distRef}
          frameloop={playing ? 'always' : 'demand'}
          showNames={false}
        />
      ) : (
        <div className="h-full w-full bg-ink-850" />
      )}
    </div>
  );
}
