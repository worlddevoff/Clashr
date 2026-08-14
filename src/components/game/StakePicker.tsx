import { useEffect, useRef, useState } from 'react';
import { STAKE_PRESETS_SOL } from '../../lib/escrow';
import { cn } from '../../utils/cn';

interface Props {
  valueSol: number;
  onChange: (sol: number) => void;
  disabled?: boolean;
  hint?: string;
}

function isPreset(sol: number): boolean {
  return (STAKE_PRESETS_SOL as readonly number[]).some((p) => p === sol);
}

export function StakePicker({ valueSol, onChange, disabled, hint }: Props) {
  const [customOpen, setCustomOpen] = useState(() => !isPreset(valueSol));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!customOpen) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [customOpen]);

  return (
    <div className={cn(disabled && 'pointer-events-none opacity-50')}>
      <div className="mb-2 font-display text-[11px] uppercase tracking-widest text-white/45">
        Stake per wallet
      </div>
      <div className="grid grid-cols-5 gap-2">
        {STAKE_PRESETS_SOL.map((sol) => (
          <button
            key={sol}
            type="button"
            disabled={disabled}
            onClick={() => {
              setCustomOpen(false);
              onChange(sol);
            }}
            className={cn(
              'rounded-xl border px-1 py-2 text-center font-display text-xs transition-colors',
              !customOpen && valueSol === sol
                ? 'border-neon-amber bg-ink-800 text-neon-amber'
                : 'border-ink-600 bg-ink-900 text-white/70 hover:border-white/30',
            )}
          >
            {sol}
          </button>
        ))}
      </div>
      <div className="mt-2">
        {customOpen ? (
          <div className="flex items-center gap-2 rounded-xl border border-neon-amber bg-ink-800 px-3 py-2">
            <input
              ref={inputRef}
              type="number"
              min={0.001}
              max={2}
              step={0.001}
              disabled={disabled}
              value={valueSol}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n)) return;
                onChange(n);
              }}
              onBlur={() => {
                if (isPreset(valueSol)) setCustomOpen(false);
              }}
              className="w-full bg-transparent font-display text-sm text-neon-amber outline-none"
            />
            <span className="shrink-0 text-xs text-white/40">SOL</span>
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => setCustomOpen(true)}
            className="w-full rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 font-display text-xs uppercase tracking-widest text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            Custom
          </button>
        )}
      </div>
      {hint ? <p className="mt-2 text-[11px] leading-snug text-white/40">{hint}</p> : null}
    </div>
  );
}
