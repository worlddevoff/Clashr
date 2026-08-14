import { CoinsIcon } from 'lucide-react';
import { formatSol } from '../../utils/format';
import { cn } from '../../utils/cn';

interface Props {
  amount: number;
  className?: string;
  showLabel?: boolean;
  onClick?: () => void;
}

export function CreditsBadge({ amount, className, showLabel, onClick }: Props) {
  const classes = cn(
    'inline-flex items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-800 px-2.5 py-1.5 font-display text-neon-lime',
    onClick && 'cursor-pointer transition-colors hover:border-neon-lime/50 hover:bg-ink-700',
    className,
  );
  const inner = (
    <>
      <CoinsIcon className="h-4 w-4" aria-hidden />
      <span className="font-semibold tabular-nums">{formatSol(amount)}</span>
      {showLabel && <span className="text-[10px] uppercase tracking-wider text-white/40">SOL</span>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {inner}
      </button>
    );
  }
  return <span className={classes}>{inner}</span>;
}
