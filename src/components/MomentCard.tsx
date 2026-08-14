import { useState } from 'react';
import { Share2Icon, CheckIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Moment } from '../types/domain';

export function MomentCard({ moment }: { moment: Moment }) {
  const [shared, setShared] = useState(false);
  const share = () => {
    setShared(true);
    window.setTimeout(() => setShared(false), 1800);
  };
  return (
    <motion.article
      whileHover={{ y: -4 }}
      transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
      className="relative overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 p-5"
    >
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl"
        style={{ backgroundColor: moment.color }}
      />
      <div className="relative flex items-start gap-3">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl"
          style={{ border: `2px solid ${moment.color}`, boxShadow: `0 0 14px ${moment.color}55` }}
        >
          {moment.avatar}
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-semibold leading-snug text-white">{moment.headline}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] uppercase tracking-wider text-white/40">
            <span>{moment.gameRef}</span>
            <span>·</span>
            <span style={{ color: moment.color }}>{moment.stat}</span>
            <span>·</span>
            <span>{moment.timeAgo}</span>
          </div>
        </div>
      </div>
      <button
        onClick={share}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-ink-600 bg-ink-800 px-3 py-2 font-display text-[11px] uppercase tracking-wide text-white/70 transition-colors duration-150 hover:border-neon-cyan/60 hover:text-neon-cyan"
      >
        {shared ? <CheckIcon className="h-3.5 w-3.5 text-neon-lime" /> : <Share2Icon className="h-3.5 w-3.5" />}
        {shared ? 'Copied to share' : 'Share'}
      </button>
    </motion.article>
  );
}
