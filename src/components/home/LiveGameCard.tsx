import { useNavigate } from 'react-router-dom';
import { UsersIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import type { LiveGame } from '../../types/domain';
import { CreditsBadge } from '../ui/CreditsBadge';
import { Button } from '../ui/Button';

const STATUS_MAP: Record<LiveGame['status'], { label: string; color: string }> = {
  filling: { label: 'Filling up', color: '#b2ff59' },
  starting: { label: 'Starting', color: '#ffb020' },
  live: { label: 'Live', color: '#ff2b2b' },
};

export function LiveGameCard({
  game,
  href,
}: {
  game: LiveGame;
  /** Real match URL — defaults to lobby. */
  href?: string;
}) {
  const navigate = useNavigate();
  const s = STATUS_MAP[game.status];
  const canJoin = game.status !== 'live';
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
      className="flex flex-col gap-4 rounded-2xl border border-ink-600 bg-ink-850 p-4"
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-sm font-semibold uppercase tracking-wide text-white">
          {game.name}
        </span>
        <span
          className="inline-flex items-center gap-1.5 font-display text-[10px] uppercase tracking-widest"
          style={{ color: s.color }}
        >
          <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: s.color }} />
          {s.label}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="inline-flex items-center gap-1.5 text-white/60">
          <UsersIcon className="h-4 w-4" />
          {game.players}/{game.capacity}
        </span>
        {game.status === 'live' ? (
          <span className="font-display text-neon-magenta">In progress</span>
        ) : (
          <span className="font-display text-white/40">
            {game.capacity - game.players} open
          </span>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/40">
            {game.prizePool > 0 ? 'Prize pool' : 'Practice'}
          </div>
          {game.prizePool > 0 ? (
            <CreditsBadge amount={game.prizePool} className="mt-1" />
          ) : (
            <div className="mt-1 font-display text-xs uppercase tracking-wide text-white/35">
              No SOL prize yet
            </div>
          )}
        </div>
        <Button
          size="sm"
          variant={canJoin ? 'primary' : 'secondary'}
          onClick={() => navigate(href ?? '/play')}
        >
          {canJoin ? 'Join' : 'Watch'}
        </Button>
      </div>
    </motion.div>
  );
}
