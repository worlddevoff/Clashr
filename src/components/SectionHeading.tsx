import { Link } from 'react-router-dom';

interface Props {
  kicker?: string;
  title: string;
  accent?: string;
  action?: { label: string; to: string };
}

export function SectionHeading({ kicker, title, accent = '#22e5ff', action }: Props) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        {kicker && (
          <div className="mb-1 font-display text-[11px] uppercase tracking-[0.22em]" style={{ color: accent }}>
            {kicker}
          </div>
        )}
        <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-white sm:text-3xl">{title}</h2>
      </div>
      {action && (
        <Link
          to={action.to}
          className="shrink-0 font-display text-xs uppercase tracking-wide text-white/50 transition-colors hover:text-neon-cyan"
        >
          {action.label} →
        </Link>
      )}
    </div>
  );
}
