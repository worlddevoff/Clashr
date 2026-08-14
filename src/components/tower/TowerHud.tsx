import { useEffect, useRef, useState } from 'react';
import type { TowerPlayerSnap, TowerSnapshot } from '../../../shared/tower/types';
import { SHOVE_COOLDOWN } from '../../../shared/tower/constants';

interface FeedLine {
  id: number;
  text: string;
  tone: 'elim' | 'save' | 'shove';
}

/** Rolling log of the last few things that happened to anyone in the match. */
function useKillFeed(snap: TowerSnapshot): FeedLine[] {
  const [lines, setLines] = useState<FeedLine[]>([]);
  const seen = useRef(0);
  const nextId = useRef(1);

  useEffect(() => {
    const fresh: FeedLine[] = [];
    for (const e of snap.events) {
      if (e.t <= seen.current) continue;
      seen.current = e.t;
      if (e.kind === 'elim' && e.text) fresh.push({ id: nextId.current++, text: e.text, tone: 'elim' });
      else if (e.kind === 'ledge_save' && e.text)
        fresh.push({ id: nextId.current++, text: e.text, tone: 'save' });
      else if (e.kind === 'shove_ko' && e.text)
        fresh.push({ id: nextId.current++, text: e.text, tone: 'shove' });
    }
    if (!fresh.length) return;
    setLines((prev) => [...prev, ...fresh].slice(-4));
  }, [snap]);

  useEffect(() => {
    if (!lines.length) return;
    const timer = window.setTimeout(() => setLines((prev) => prev.slice(1)), 4200);
    return () => window.clearTimeout(timer);
  }, [lines]);

  return lines;
}

export function TowerHud({
  snap,
  humanId,
  name,
  avatar,
  practice,
  spectating,
  onSpectatePrev,
  onSpectateNext,
  onPause,
  onLeave,
}: {
  snap: TowerSnapshot;
  humanId: string;
  name: string;
  avatar: string;
  practice: boolean;
  spectating: TowerPlayerSnap | null;
  onSpectatePrev: () => void;
  onSpectateNext: () => void;
  onPause: () => void;
  onLeave: () => void;
}) {
  const you = snap.players.find((p) => p.id === humanId);
  const rank = you?.rank ?? snap.players.length;
  const cd = you?.shoveCd ?? 0;
  const shoveReady = cd <= 0.05;
  const feed = useKillFeed(snap);
  const out = !!you && !you.alive;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 font-display text-white">
      <div className="absolute left-4 top-4 rounded-xl border border-white/10 bg-ink-950/70 px-3 py-2 backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Position</div>
        <div className="text-2xl font-bold tabular-nums">
          # {rank} / {snap.players.length}
        </div>
      </div>

      <div className="absolute left-1/2 top-4 -translate-x-1/2 rounded-xl border border-white/10 bg-ink-950/70 px-4 py-2 text-center backdrop-blur">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Floor</div>
        <div className="text-2xl font-bold tabular-nums text-neon-cyan">
          {(out ? spectating?.floor : you?.floor) ?? 1} / {snap.floorCount}
        </div>
      </div>

      <div className="absolute right-4 top-4 flex flex-col items-end gap-2">
        <div className="rounded-xl border border-white/10 bg-ink-950/70 px-3 py-2 text-right backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Players</div>
          <div className="text-2xl font-bold tabular-nums text-neon-lime">
            {snap.aliveCount} ALIVE
          </div>
        </div>
        <button
          type="button"
          onClick={onPause}
          className="pointer-events-auto rounded-lg border border-white/15 bg-ink-950/70 px-3 py-1.5 text-[10px] uppercase tracking-widest text-white/70 backdrop-blur hover:bg-white/10"
        >
          Menu · Esc
        </button>
      </div>

      <div className="absolute right-4 top-32 w-56 space-y-1 text-right">
        {feed.map((line) => (
          <div
            key={line.id}
            className={`truncate rounded-md bg-ink-950/60 px-2 py-1 text-[11px] backdrop-blur ${
              line.tone === 'elim'
                ? 'text-neon-magenta'
                : line.tone === 'save'
                  ? 'text-neon-lime'
                  : 'text-white/70'
            }`}
          >
            {line.text}
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-xl border border-white/10 bg-ink-950/70 px-3 py-2 backdrop-blur">
        <span className="grid h-10 w-10 place-items-center rounded-lg text-2xl">{avatar}</span>
        <div>
          <div className="text-sm font-semibold">{name}</div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">
            {practice ? 'Practice' : 'CLASHR'}
          </div>
        </div>
      </div>

      {!out && (
        <div className="absolute bottom-4 right-4 rounded-xl border border-neon-magenta/40 bg-ink-950/70 px-4 py-2 text-right backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Shove</div>
          <div className="text-xl font-bold text-neon-magenta">
            {shoveReady ? 'READY' : cd.toFixed(1)}
          </div>
          <div className="mt-1 h-1 w-20 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-neon-magenta transition-[width] duration-100"
              style={{ width: `${(1 - cd / SHOVE_COOLDOWN) * 100}%` }}
            />
          </div>
        </div>
      )}

      {!out && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-center text-[10px] uppercase tracking-widest text-white/30">
          WASD move · mouse look · Space jump · Click/F shove · Shift dash · Esc menu
        </div>
      )}

      {out && (
        <div className="pointer-events-auto absolute inset-x-0 bottom-6 mx-auto w-fit rounded-2xl border border-white/10 bg-ink-950/85 px-5 py-4 text-center backdrop-blur">
          <div className="text-[10px] uppercase tracking-[0.25em] text-neon-magenta">
            You&apos;re out
            {you?.placement ? ` · finished #${you.placement}` : ''}
          </div>
          <div className="mt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onSpectatePrev}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 text-white/70 hover:bg-white/10"
              aria-label="Previous player"
            >
              ‹
            </button>
            <div className="min-w-[10rem]">
              <div className="text-[10px] uppercase tracking-widest text-white/40">Spectating</div>
              <div className="text-base font-semibold" style={{ color: spectating?.color }}>
                {spectating ? spectating.username : 'Nobody left'}
              </div>
            </div>
            <button
              type="button"
              onClick={onSpectateNext}
              className="grid h-8 w-8 place-items-center rounded-lg border border-white/15 text-white/70 hover:bg-white/10"
              aria-label="Next player"
            >
              ›
            </button>
          </div>
          <button
            type="button"
            onClick={onLeave}
            className="mt-3 w-full rounded-lg border border-neon-magenta/50 px-4 py-1.5 text-[11px] uppercase tracking-widest text-neon-magenta hover:bg-neon-magenta/10"
          >
            Leave match
          </button>
        </div>
      )}

      {snap.warning && (
        <div className="absolute inset-x-0 top-24 flex justify-center">
          <div className="animate-pulse rounded-xl border border-neon-amber bg-ink-950/90 px-5 py-2 text-lg font-bold uppercase tracking-[0.18em] text-neon-amber">
            {snap.warning}
          </div>
        </div>
      )}

      {snap.phase === 'countdown' && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-7xl font-bold text-white text-glow-cyan">
              {Math.max(1, Math.ceil(snap.countdown))}
            </div>
            <div className="mt-2 text-[11px] uppercase tracking-[0.25em] text-white/50">
              Climb to floor {snap.floorCount} · shove everyone else off
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
