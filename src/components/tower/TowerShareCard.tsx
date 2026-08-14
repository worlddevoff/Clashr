import { useState } from 'react';
import type { TowerMoment } from '../../../shared/tower/types';

export function TowerShareCard({ moment }: { moment: TowerMoment }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const text = `${moment.headline}\n${moment.stat}\nCLASHR: TOWER — CLIMB. SHOVE. SURVIVE.\nVIRTUAL / DEMO CREDITS — NO REAL-WORLD VALUE`;
    try {
      if (navigator.share) await navigator.share({ title: 'CLASHR: TOWER', text });
      else await navigator.clipboard.writeText(text);
    } catch {
      await navigator.clipboard.writeText(text);
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1600);
  };

  return (
    <article className="rounded-2xl border border-ink-600 bg-ink-850 p-4">
      <div className="text-[10px] uppercase tracking-widest text-neon-cyan">{moment.kind.replaceAll('_', ' ')}</div>
      <p className="mt-1 font-display text-base font-semibold">{moment.headline}</p>
      <p className="mt-1 text-xs text-white/45">{moment.stat}</p>
      <button
        type="button"
        onClick={() => void share()}
        className="mt-3 rounded-lg border border-ink-600 px-3 py-1.5 font-display text-[11px] uppercase tracking-wide text-white/70 hover:border-neon-cyan"
      >
        {done ? 'Copied' : 'Share moment'}
      </button>
    </article>
  );
}
