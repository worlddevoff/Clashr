import { useNavigate } from 'react-router-dom';
import { LockIcon, PlayIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import type { FeaturedGame } from '../../types/domain';
import { ACCENT_HEX } from '../../utils/cn';
import { Button } from '../ui/Button';

const LIVE_SLUGS = new Set(['tower', 'bomb-party']);

export function FeaturedGameCard({ game }: { game: FeaturedGame }) {
  const navigate = useNavigate();
  const accent = ACCENT_HEX[game.accent];
  const locked = !LIVE_SLUGS.has(game.slug);
  const href = `/play/${game.slug}`;

  return (
    <motion.div
      whileHover={{ y: -6 }}
      transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
      role={locked ? undefined : 'link'}
      tabIndex={locked ? undefined : 0}
      onClick={() => {
        if (!locked) navigate(href);
      }}
      onKeyDown={(e) => {
        if (!locked && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          navigate(href);
        }
      }}
      className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-2xl border p-5"
      style={{ borderColor: `${accent}44`, backgroundColor: '#0b0b15', cursor: locked ? 'default' : 'pointer' }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at 50% 120%, ${accent}33, transparent 65%)` }}
      />
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />

      <div className="relative flex items-start justify-between">
        <motion.span
          className="text-5xl"
          animate={locked ? {} : { rotate: [0, -6, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {game.emoji}
        </motion.span>
        {locked ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-ink-800/80 px-2 py-1 font-display text-[9px] uppercase tracking-widest text-white/50">
            <LockIcon className="h-3 w-3" /> Soon
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-display text-[9px] uppercase tracking-widest text-ink-950"
            style={{ backgroundColor: accent }}
          >
            Live
          </span>
        )}
      </div>

      <div className="relative">
        <h3 className="font-display text-xl font-bold uppercase tracking-tight text-white" style={{ textShadow: `0 0 16px ${accent}66` }}>
          {game.name}
        </h3>
        <p className="mt-1 text-xs text-white/50">{game.tagline}</p>
        <div className="mt-4">
          {locked ? (
            <div className="rounded-xl border border-ink-600 bg-ink-900/60 py-2.5 text-center font-display text-[10px] uppercase tracking-widest text-white/40">
              In development
            </div>
          ) : (
            <Button
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                navigate(href);
              }}
            >
              <PlayIcon className="h-4 w-4" /> Play {game.name}
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
