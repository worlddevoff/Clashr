import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { PlayIcon, RadioIcon, SkullIcon, ZapIcon } from 'lucide-react';
import { Arena } from '../game/Arena';
import { BombPartyEngine, type BombPartySeedPlayer } from '../../game/BombPartyEngine';
import { AVATARS, BOT_NAMES, NEON_COLORS } from '../../data/avatars';
import type { EngineSnapshot } from '../../types/game';

const ARENA = { width: 900, height: 620 };
const PREVIEW_ID = '__preview__';
const PLAYER_COUNT = 5;
const RESTART_MS = 2400;
const DEMO_SECONDS = 15;
type DemoStatus = 'idle' | 'playing' | 'finished';

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function makeSeed(interactive: boolean): BombPartySeedPlayer[] {
  const names = shuffle(BOT_NAMES);
  const avatars = shuffle(AVATARS);
  const colors = shuffle(NEON_COLORS);
  return Array.from({ length: PLAYER_COUNT }, (_, i) => ({
    id: interactive && i === 0 ? PREVIEW_ID : `preview-${i}`,
    username: interactive && i === 0 ? 'You' : names[i % names.length],
    avatar: avatars[i % avatars.length],
    color: colors[i % colors.length],
    isHuman: interactive && i === 0,
  }));
}

// Attract-mode Bomb Party: the real engine + arena, looping matches so the
// homepage shows an actual game instead of a fake chase loop.
export function HeroBombPreview() {
  const navigate = useNavigate();
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BombPartyEngine | null>(null);
  const visibleRef = useRef(true);
  const [round, setRound] = useState(0);
  const [demoRun, setDemoRun] = useState(0);
  const [demoStatus, setDemoStatus] = useState<DemoStatus>('idle');
  const [demoSeconds, setDemoSeconds] = useState(DEMO_SECONDS);
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const interactive = demoRun > 0;
    const engine = new BombPartyEngine(makeSeed(interactive), {
      arena: ARENA,
      startTimer: 14,
      passTimeBonus: 0,
      humanId: PREVIEW_ID,
      countdownMs: 0,
      holderId: interactive ? PREVIEW_ID : undefined,
    });
    engineRef.current = engine;
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
      const play =
        (!reduce || interactive) && document.visibilityState === 'visible' && visibleRef.current;
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
          { threshold: 0.2 },
        )
      : null;
    if (root && io) io.observe(root);

    document.addEventListener('visibilitychange', sync);
    visibleRef.current = true;
    sync();

    return () => {
      if (restart != null) window.clearTimeout(restart);
      unsub();
      engine.stop();
      if (engineRef.current === engine) engineRef.current = null;
      io?.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [round, demoRun]);

  useEffect(() => {
    if (demoStatus !== 'playing') return;
    wrapRef.current?.focus();
    const timer = window.setInterval(() => {
      setDemoSeconds((seconds) => {
        if (seconds <= 1) {
          window.clearInterval(timer);
          setDemoStatus('finished');
          return 0;
        }
        return seconds - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [demoStatus, demoRun]);

  const startDemo = () => {
    setDemoSeconds(DEMO_SECONDS);
    setDemoStatus('playing');
    setDemoRun((run) => run + 1);
  };

  const setKey = (code: string, pressed: boolean) => {
    const directions: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
    };
    const direction = directions[code];
    if (!direction || demoStatus !== 'playing') return false;
    engineRef.current?.setKey(PREVIEW_ID, direction, pressed);
    return true;
  };

  const alive = snap?.aliveCount ?? PLAYER_COUNT;
  const winner = snap?.status === 'finished' ? snap.winner : null;
  const holder = snap?.players.find((player) => player.hasBomb);
  const fuse = snap?.bomb?.timeLeft ?? 0;
  const isDanger = fuse > 0 && fuse < 3;
  const passes = snap?.bomb?.passCount ?? 0;
  const eliminated = PLAYER_COUNT - alive;
  const playersLabel =
    snap?.status === 'live' && alive < PLAYER_COUNT ? `${alive} left` : `${PLAYER_COUNT} players`;

  return (
    <div
      ref={wrapRef}
      tabIndex={demoStatus === 'playing' ? 0 : -1}
      onKeyDown={(event) => {
        if (setKey(event.code, true)) event.preventDefault();
      }}
      onKeyUp={(event) => {
        if (setKey(event.code, false)) event.preventDefault();
      }}
      onBlur={() => {
        for (const direction of ['up', 'down', 'left', 'right'] as const) {
          engineRef.current?.setKey(PREVIEW_ID, direction, false);
        }
      }}
          className="group relative w-full overflow-hidden rounded-xl border-0 bg-ink-900 shadow-none"
      aria-label={demoStatus === 'playing' ? 'Bomb Party playable demo' : undefined}
    >
      <div className="pointer-events-none absolute -inset-px z-50 rounded-[1.75rem] bg-[linear-gradient(120deg,rgba(178,255,89,.6),transparent_18%,transparent_78%,rgba(160,107,255,.7))] p-px opacity-60">
        <div className="h-full w-full rounded-[calc(1.75rem-1px)] bg-transparent" />
      </div>

      {snap ? (
        <Arena
          snap={snap}
          humanId={PREVIEW_ID}
          arena={ARENA}
          onPointerMove={(x, y) => {
            if (demoStatus === 'playing') {
              engineRef.current?.setMoveTarget(PREVIEW_ID, { x, y });
            }
          }}
          className={`${demoStatus === 'playing' ? 'cursor-crosshair' : 'pointer-events-none'} rounded-none border-0`}
        />
      ) : (
        <div className="aspect-[900/620] w-full bg-ink-900" />
      )}

      {/* Neon cabinet corners, inspired by the homepage concept. */}
      <div className="pointer-events-none absolute left-0 top-0 z-50 h-16 w-16 rounded-br-3xl border-b-2 border-r-2 border-neon-lime shadow-[8px_8px_24px_rgba(178,255,89,.22),inset_-5px_-5px_18px_rgba(178,255,89,.12)]" />
      <div className="pointer-events-none absolute right-0 top-0 z-50 h-16 w-16 rounded-bl-3xl border-b-2 border-l-2 border-neon-violet shadow-[-8px_8px_24px_rgba(160,107,255,.28),inset_5px_-5px_18px_rgba(160,107,255,.16)]" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between bg-gradient-to-b from-ink-950/85 via-ink-950/25 to-transparent p-4 pb-12">
        <div className="inline-flex items-center gap-2 rounded-full border border-neon-magenta/40 bg-ink-950/80 px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.18em] text-neon-magenta shadow-[0_0_20px_rgba(255,43,43,.15)] backdrop-blur-md">
          <RadioIcon className="h-3 w-3" />
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-neon-magenta opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-neon-magenta" />
          </span>
          Live match
        </div>
        <div className="rounded-full border border-white/10 bg-ink-950/80 px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.18em] text-white/70 backdrop-blur-md">
          {playersLabel}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {holder && snap?.status === 'live' ? (
          <motion.div
            key={holder.id}
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            className="pointer-events-none absolute left-1/2 top-4 z-50 -translate-x-1/2"
          >
            <div
              className="flex items-center gap-2 rounded-full border bg-ink-950/90 px-3 py-1.5 backdrop-blur-md"
              style={{
                borderColor: isDanger ? 'rgba(255,43,43,.75)' : 'rgba(255,176,32,.45)',
                boxShadow: isDanger
                  ? '0 0 28px rgba(255,43,43,.38)'
                  : '0 0 22px rgba(255,176,32,.16)',
              }}
            >
              <span className="text-base">{holder.avatar}</span>
              <span className="hidden font-display text-[9px] uppercase tracking-widest text-white/55 sm:inline">
                {holder.username}
              </span>
              <motion.span
                className="text-lg leading-none"
                animate={{ scale: [1, isDanger ? 1.25 : 1.1, 1], rotate: isDanger ? [0, -10, 10, 0] : 0 }}
                transition={{ duration: isDanger ? 0.28 : 0.55, repeat: Infinity }}
                style={{ filter: `drop-shadow(0 0 ${isDanger ? 14 : 8}px #ff5a2e)` }}
              >
                💣
              </motion.span>
              <span
                className="font-display text-xs font-bold tabular-nums"
                style={{ color: isDanger ? '#ff2b2b' : '#ffb020' }}
              >
                {fuse.toFixed(1)}s
              </span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <div className="pointer-events-none absolute bottom-4 left-4 z-40 flex gap-2">
        <div className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-ink-950/75 px-2.5 py-1.5 font-display text-[9px] uppercase tracking-widest text-white/55 backdrop-blur-md sm:flex">
          <ZapIcon className="h-3 w-3 text-neon-cyan" />
          {passes} passes
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-950/75 px-2.5 py-1.5 font-display text-[9px] uppercase tracking-widest text-white/55 backdrop-blur-md">
          <SkullIcon className="h-3 w-3 text-neon-magenta" />
          {eliminated} out
        </div>
      </div>

      <AnimatePresence>
        {winner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-ink-950/60 backdrop-blur-[3px]"
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.4, rotate: -12 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 15 }}
                className="text-6xl drop-shadow-[0_0_24px_rgba(255,43,43,0.75)]"
              >
                {winner.avatar}
              </motion.div>
              <div className="mt-3 font-display text-2xl font-bold uppercase tracking-wide text-white">
                {winner.username} wins
              </div>
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-neon-lime/25 bg-neon-lime/10 px-3 py-1 font-display text-[9px] uppercase tracking-widest text-neon-lime">
                <ZapIcon className="h-3 w-3" />
                Next round loading
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {demoStatus === 'idle' ? (
          <motion.button
            key="start"
            type="button"
            onClick={startDemo}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-cyan"
            aria-label={`Try Bomb Party for ${DEMO_SECONDS} seconds`}
          >
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-end bg-gradient-to-t from-ink-950/95 via-ink-950/40 to-transparent px-4 pb-4 pt-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-neon-cyan/60 bg-ink-950/90 px-4 py-2.5 font-display text-[10px] font-semibold uppercase tracking-widest text-white shadow-[0_0_26px_rgba(34,229,255,.24)] backdrop-blur-md transition duration-200 group-hover:-translate-y-1 group-hover:border-neon-magenta group-hover:shadow-[0_0_28px_rgba(255,43,43,.34)]">
                <PlayIcon className="h-3.5 w-3.5 fill-neon-cyan text-neon-cyan" />
                Try it for {DEMO_SECONDS}s
              </span>
            </span>
          </motion.button>
        ) : demoStatus === 'playing' ? (
          <motion.div
            key="playing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="pointer-events-none absolute bottom-4 right-4 z-50 flex flex-col items-end gap-2"
          >
            <div className="rounded-full border border-neon-lime/40 bg-ink-950/85 px-3 py-1.5 font-display text-[9px] uppercase tracking-widest text-white/70 backdrop-blur-md">
              Click or tap to move <span className="hidden text-white/35 sm:inline">· WASD</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-neon-cyan/50 bg-ink-950/90 px-3 py-1.5 shadow-[0_0_22px_rgba(34,229,255,.18)] backdrop-blur-md">
              <span className="font-display text-[9px] uppercase tracking-widest text-neon-cyan">
                Your turn
              </span>
              <span className="font-display text-xs font-bold tabular-nums text-white">
                {demoSeconds}s
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="finished"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[60] grid place-items-center bg-ink-950/75 p-5 backdrop-blur-[4px]"
          >
            <motion.div
              initial={{ y: 16, scale: 0.96 }}
              animate={{ y: 0, scale: 1 }}
              className="text-center"
            >
              <div className="font-display text-[10px] uppercase tracking-[0.28em] text-neon-cyan">
                Demo complete
              </div>
              <div className="mt-2 font-display text-2xl font-bold uppercase text-white sm:text-3xl">
                Ready for the real thing?
              </div>
              <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/play/bomb-party')}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-neon-magenta px-4 py-2.5 font-display text-[10px] font-semibold uppercase tracking-widest text-white shadow-[0_0_24px_rgba(255,43,43,.38)] transition hover:-translate-y-0.5 hover:shadow-[0_0_32px_rgba(255,43,43,.55)]"
                >
                  <PlayIcon className="h-3.5 w-3.5 fill-current" />
                  Play full game
                </button>
                <button
                  type="button"
                  onClick={startDemo}
                  className="rounded-full border border-white/15 bg-white/5 px-4 py-2.5 font-display text-[10px] uppercase tracking-widest text-white/65 transition hover:border-neon-cyan/50 hover:text-white"
                >
                  Try again
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {demoStatus === 'playing' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-50 h-1 bg-white/5">
          <motion.div
            className="h-full origin-left bg-gradient-to-r from-neon-cyan via-neon-lime to-neon-magenta shadow-[0_0_12px_rgba(34,229,255,.65)]"
            initial={{ scaleX: 1 }}
            animate={{ scaleX: demoSeconds / DEMO_SECONDS }}
            transition={{ duration: 0.25, ease: 'linear' }}
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(transparent_50%,rgba(0,0,0,.12)_50%)] bg-[length:100%_4px] opacity-25" />
      <div className="pointer-events-none absolute inset-0 z-10 shadow-[inset_0_0_80px_rgba(0,0,0,.72)] transition-shadow duration-300 group-hover:shadow-[inset_0_0_55px_rgba(0,0,0,.5)]" />
    </div>
  );
}
