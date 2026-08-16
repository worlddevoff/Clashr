import { useEffect, useRef, useState } from 'react';
import { Arena } from '../game/Arena';
import { BombPartyEngine, type BombPartySeedPlayer } from '../../game/BombPartyEngine';
import { getBombMap } from '../../game/bombMaps';
import { AVATARS, BOT_NAMES, NEON_COLORS } from '../../data/avatars';
import type { EngineSnapshot } from '../../types/game';

const ARENA = { width: 900, height: 620 };
const PLAYER_COUNT = 5;
const RESTART_MS = 2200;

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function makeSeed(): BombPartySeedPlayer[] {
  const names = shuffle(BOT_NAMES);
  const avatars = shuffle(AVATARS);
  const colors = shuffle(NEON_COLORS);
  return Array.from({ length: PLAYER_COUNT }, (_, i) => ({
    id: `lineup-bomb-${i}`,
    username: names[i % names.length],
    avatar: avatars[i % avatars.length],
    color: colors[i % colors.length],
    isHuman: false,
  }));
}

export function LineupBombPreview() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(false);
  const [round, setRound] = useState(0);
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const map = getBombMap(Math.floor(Math.random() * 1_000_000_000), ARENA.width, ARENA.height);
    const engine = new BombPartyEngine(makeSeed(), {
      arena: ARENA,
      startTimer: 14,
      passTimeBonus: 0,
      humanId: '',
      countdownMs: 0,
      hazards: map.hazards,
      mapId: map.id,
    });
    setSnap(engine.snapshot());

    let restart: number | null = null;
    const unsub = engine.subscribe((s) => {
      setSnap(s);
      if (s.status === 'finished' && restart == null) {
        restart = window.setTimeout(() => setRound((r) => r + 1), RESTART_MS);
      }
    });

    let running = false;
    const sync = () => {
      const play = !reduce && document.visibilityState === 'visible' && visibleRef.current;
      if (play && !running) {
        running = true;
        engine.start();
      } else if (!play && running) {
        running = false;
        engine.stop();
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
      unsub();
      engine.stop();
      io?.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [round]);

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden bg-ink-900" aria-hidden>
      {snap ? (
        <div className="absolute left-1/2 top-1/2 w-[145%] min-w-full -translate-x-1/2 -translate-y-1/2">
          <Arena
            snap={snap}
            humanId=""
            arena={ARENA}
            onPointerMove={() => undefined}
            className="pointer-events-none rounded-none border-0"
          />
        </div>
      ) : (
        <div className="h-full w-full bg-ink-850" />
      )}
    </div>
  );
}
