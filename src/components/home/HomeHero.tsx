import { motion } from 'framer-motion';
import { PlayIcon, TrophyIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { HeroBombPreview } from './HeroBombPreview';
import { SITE_TITLE } from '../../lib/brand';
import type { PublicPartyListing } from '../../types/party';

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0 },
};

export function HomeHero({
  liveCount,
  openTables,
}: {
  liveCount: number;
  openTables: PublicPartyListing[];
}) {
  const navigate = useNavigate();

  return (
    <section id="top" className="relative overflow-hidden border-b border-line">
      <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden />
      <div
        className="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-neon-magenta/10 blur-[120px]"
        aria-hidden
      />

      <div className="relative mx-auto grid w-full max-w-[1240px] items-center gap-12 px-5 py-16 lg:grid-cols-[minmax(0,1fr)_1.05fr] lg:gap-16 lg:px-8 lg:py-24">
        <motion.div
          initial="hidden"
          animate="show"
          transition={{ staggerChildren: 0.05 }}
          className="max-w-xl"
        >
          <motion.div variants={rise} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}>
            <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-neon-magenta/40 bg-neon-magenta/10 px-3 py-1 text-neon-soft">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-magenta" aria-hidden />
              {liveCount} games live
              {openTables.length > 0 ? ` · ${openTables.length} open tables` : ''}
            </span>
          </motion.div>

          <motion.h1
            variants={rise}
            transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
            className="mt-6 font-display text-5xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            <span className="sr-only">{SITE_TITLE}</span>
            Stake it.
            <br />
            Clash for it.
            <br />
            <span className="text-neon-magenta">Take the pot.</span>
          </motion.h1>

          <motion.p
            variants={rise}
            transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
            className="mt-6 text-lg leading-relaxed text-muted"
          >
            Fast crypto PvP arcade games settled on Solana. Match up in seconds, play a short round, and
            the winner walks away with every lamport on the table.
          </motion.p>

          <motion.div
            variants={rise}
            transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Button size="lg" className="rounded-md shadow-glow" onClick={() => navigate('/play')}>
              <PlayIcon className="h-4 w-4" /> Join a table
            </Button>
            <Button size="lg" variant="secondary" className="rounded-md" onClick={() => navigate('/leaderboard')}>
              <TrophyIcon className="h-4 w-4 text-neon-cyan" /> Leaderboard
            </Button>
          </motion.div>

          <motion.dl
            variants={rise}
            transition={{ duration: 0.32, ease: [0.23, 1, 0.32, 1] }}
            className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4 border-t border-line pt-6"
          >
            {[
              { label: 'Games live', value: String(liveCount) },
              { label: 'Open tables', value: String(openTables.length) },
              { label: 'Avg. match', value: '~90s' },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="eyebrow text-muted">{stat.label}</dt>
                <dd className="mt-1 font-display text-xl font-semibold text-white">{stat.value}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        <motion.figure
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.08 }}
          className="relative overflow-hidden rounded-xl border border-white/10 bg-ink-900 shadow-panel"
        >
          <HeroBombPreview />
        </motion.figure>
      </div>
    </section>
  );
}
