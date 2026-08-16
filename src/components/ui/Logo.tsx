import { cn } from '../../utils/cn';
import { SITE_TITLE } from '../../lib/brand';

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline font-display font-bold tracking-tight text-white',
        compact ? 'text-lg' : 'text-xl sm:text-2xl',
        className,
      )}
      aria-label={SITE_TITLE}
    >
      CLASH
      <span className="text-neon-magenta drop-shadow-[0_0_8px_rgba(255,43,43,0.55)]">R</span>
    </span>
  );
}
