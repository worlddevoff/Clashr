import { UsersIcon, FlameIcon } from 'lucide-react';
import type { EngineSnapshot } from '../../types/game';
import { formatDuration, formatSol } from '../../utils/format';

interface Props {
  snap: EngineSnapshot;
  prizePool: number;
  gameNumber: number;
  practiceMode?: boolean;
}

export function GameHud({ snap, prizePool, gameNumber, practiceMode }: Props) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between p-4">
      <div className="pointer-events-auto rounded-xl border border-ink-600 bg-ink-950/80 px-3 py-2 backdrop-blur">
        <div className="font-display text-xs uppercase tracking-widest text-neon-magenta">Bomb Party #{gameNumber}</div>
        <div className="mt-0.5 flex items-center gap-3 text-xs text-white/60">
          <span className="inline-flex items-center gap-1">
            <UsersIcon className="h-3.5 w-3.5" /> {snap.aliveCount} left
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums">
            <FlameIcon className="h-3.5 w-3.5" /> {formatDuration(snap.elapsedMs / 1000)}
          </span>
        </div>
      </div>

      <div className="pointer-events-auto rounded-xl border border-ink-600 bg-ink-950/80 px-3 py-2 text-right backdrop-blur">
        {practiceMode ? (
          <>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Mode</div>
            <div className="mt-1 font-display text-sm font-semibold uppercase text-white/70">
              Practice
            </div>
            <div className="text-[9px] uppercase tracking-widest text-white/30">No SOL prize</div>
          </>
        ) : (
          <>
            <div className="text-[10px] uppercase tracking-widest text-white/40">Winner takes</div>
            <div className="mt-1 font-display text-sm font-semibold text-neon-lime">{formatSol(prizePool)}</div>
          </>
        )}
      </div>
    </div>
  );
}
