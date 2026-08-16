import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MomentCard } from '../components/MomentCard';
import { SectionHeading } from '../components/SectionHeading';
import { MOMENTS } from '../data/demo';
import { fetchTowerMoments } from '../lib/towerApi';
import type { Moment } from '../types/domain';

export function MomentsPage() {
  const [tower, setTower] = useState<Moment[]>([]);
  useEffect(() => {
    void fetchTowerMoments().then((rows) => {
      setTower(
        rows.map((r) => ({
          id: r.id,
          headline: r.headline,
          gameRef: 'CLASHR: TOWER',
          player: r.player,
          avatar: r.avatar,
          color: r.color,
          stat: r.stat,
          timeAgo: r.kind,
        })),
      );
    });
  }, []);
  const all = [...tower, ...MOMENTS];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-violet">Straight from the arena</div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">Moments</h1>
        <p className="mt-1 text-sm text-white/55">The wildest finishes across Clashr. Share the ones you love.</p>
      </div>

      <section className="mb-10">
        <SectionHeading kicker="Watch live" title="Live Now" accent="#ff2b2b" />
        <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-850 px-6 py-10 text-center text-sm text-white/45">
          Open matches appear on Home and in the lobby when someone hosts a public party.
        </div>
      </section>

      <SectionHeading kicker="Replays" title="Top Moments" accent="#a06bff" />
      <motion.div
        variants={{ show: { transition: { staggerChildren: 0.05 } } }}
        initial="hidden"
        animate="show"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {all.map((m) => (
          <motion.div key={m.id} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }} transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}>
            <MomentCard moment={m} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
