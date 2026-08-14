import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EngineSnapshot } from '../../types/game';
import { cn } from '../../utils/cn';
import { Character } from './Character';
import { Explosion } from './Explosion';

interface Blast {
  id: number;
  x: number;
  y: number;
}

interface Props {
  snap: EngineSnapshot;
  humanId: string;
  arena: { width: number; height: number };
  onPointerMove: (x: number, y: number) => void;
  className?: string;
  /** Hide the in-arena bomb sprite (used when a parent draws a larger overlay). */
  suppressBomb?: boolean;
}

// The play surface. Renders characters, the countdown, explosions, and applies
// screen-shake. Pointer / touch anywhere sets a move target for the human.
export function Arena({ snap, humanId, arena, onPointerMove, className, suppressBomb }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [blasts, setBlasts] = useState<Blast[]>([]);
  const prevAliveRef = useRef<Set<string>>(new Set(snap.players.filter((p) => p.alive).map((p) => p.id)));

  // detect eliminations to spawn a blast at the character's last position
  useEffect(() => {
    const nowAlive = new Set(snap.players.filter((p) => p.alive).map((p) => p.id));
    for (const p of snap.players) {
      if (prevAliveRef.current.has(p.id) && !nowAlive.has(p.id)) {
        const id = Date.now() + Math.random();
        setBlasts((b) => [...b, { id, x: p.pos.x, y: p.pos.y }]);
        window.setTimeout(() => setBlasts((b) => b.filter((x) => x.id !== id)), 700);
      }
    }
    prevAliveRef.current = nowAlive;
  }, [snap.players]);

  const toArena = (clientX: number, clientY: number) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const sx = arena.width / rect.width;
    const sy = arena.height / rect.height;
    onPointerMove((clientX - rect.left) * sx, (clientY - rect.top) * sy);
  };

  const bomb = snap.bomb;

  return (
    <div
      ref={ref}
      onPointerDown={(e) => toArena(e.clientX, e.clientY)}
      onPointerMove={(e) => {
        if (e.buttons === 1) toArena(e.clientX, e.clientY);
      }}
      className={cn(
        'relative mx-auto w-full touch-none overflow-hidden rounded-3xl border border-ink-600 bg-ink-900',
        className,
      )}
      style={{ aspectRatio: `${arena.width} / ${arena.height}` }}
    >
      <motion.div
        className="absolute inset-0"
        animate={{ x: snap.shake ? (Math.random() - 0.5) * snap.shake : 0, y: snap.shake ? (Math.random() - 0.5) * snap.shake : 0 }}
        transition={{ duration: 0.05 }}
      >
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(255,46,168,0.06), transparent 65%)' }}
        />

        {/* scale layer maps engine coords -> element size (arena is fixed logical size) */}
        <ArenaScaler arena={arena} containerRef={ref}>
          {/* ice patches under everything */}
          {(snap.hazards ?? []).map((h) =>
            h.kind === 'ice' ? (
              <div
                key={h.id}
                className="pointer-events-none absolute rounded-2xl"
                style={{
                  left: h.x,
                  top: h.y,
                  width: h.w,
                  height: h.h,
                  background:
                    'linear-gradient(135deg, rgba(120,210,255,0.22), rgba(34,229,255,0.08))',
                  border: '1px solid rgba(34,229,255,0.35)',
                  boxShadow: 'inset 0 0 24px rgba(180,240,255,0.15)',
                  zIndex: 1,
                }}
              />
            ) : null,
          )}
          {/* solid blocks */}
          {(snap.hazards ?? []).map((h) =>
            h.kind === 'block' ? (
              <div
                key={h.id}
                className="pointer-events-none absolute rounded-xl"
                style={{
                  left: h.x,
                  top: h.y,
                  width: h.w,
                  height: h.h,
                  background:
                    'linear-gradient(160deg, #1a1a2e 0%, #0d0d18 55%, #16162a 100%)',
                  border: '2px solid rgba(255,255,255,0.12)',
                  boxShadow: '0 8px 0 rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
                  zIndex: 4,
                }}
              />
            ) : null,
          )}
          {/* shrinking safe zone: the box-shadow darkens everything outside it */}
          <div
            className="pointer-events-none absolute rounded-2xl"
            style={{
              left: snap.safeZone.x,
              top: snap.safeZone.y,
              width: snap.safeZone.w,
              height: snap.safeZone.h,
              boxShadow: `0 0 0 9999px rgba(120, 6, 30, ${snap.safeZone.storm ? 0.5 : 0.28}), inset 0 0 40px rgba(255,46,168,0.15)`,
              border: `3px solid ${snap.safeZone.storm ? 'rgba(255,46,108,0.9)' : 'rgba(34,229,255,0.55)'}`,
              transition: 'border-color 0.3s ease-out',
              zIndex: 5,
            }}
          />
          {snap.players.map((p) => (
            <Character
              key={p.id}
              player={p}
              bombTimeLeft={suppressBomb ? null : p.hasBomb ? bomb?.timeLeft ?? null : null}
              intensity={bomb?.intensity ?? 0}
              isYou={p.id === humanId}
            />
          ))}
          <AnimatePresence>
            {blasts.map((b) => (
              <Explosion key={b.id} x={b.x} y={b.y} />
            ))}
          </AnimatePresence>
        </ArenaScaler>
      </motion.div>

      {/* zone-closing alert */}
      <AnimatePresence>
        {snap.safeZone.closing && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-none absolute left-1/2 top-16 z-40 -translate-x-1/2"
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-neon-magenta/60 bg-ink-950/85 px-3 py-1 font-display text-[10px] uppercase tracking-widest text-neon-magenta backdrop-blur">
              <motion.span
                className="h-2 w-2 rounded-full bg-neon-magenta"
                animate={{ opacity: [1, 0.2, 1] }}
                transition={{ duration: 0.8, repeat: Infinity }}
              />
              Arena closing — get inside
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* pre-game countdown */}
      <AnimatePresence>
        {snap.status === 'countdown' && (
          <motion.div
            className="absolute inset-0 z-50 grid place-items-center bg-ink-950/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              key={snap.countdown}
              initial={{ scale: 2.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
              className="font-display text-8xl font-bold text-neon-cyan text-glow-cyan"
            >
              {snap.countdown > 0 ? snap.countdown : 'GO!'}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Scales the fixed logical arena to fit the responsive container.
function ArenaScaler({
  arena,
  containerRef,
  children,
}: {
  arena: { width: number; height: number };
  containerRef: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / arena.width);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [arena.width, containerRef]);

  return (
    <div
      className="absolute left-0 top-0"
      style={{ width: arena.width, height: arena.height, transform: `scale(${scale})`, transformOrigin: 'top left' }}
    >
      {children}
    </div>
  );
}
