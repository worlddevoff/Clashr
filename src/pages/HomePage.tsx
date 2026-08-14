import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlayIcon, TrophyIcon, FlameIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Logo } from '../components/ui/Logo';
import { HeroBombPreview } from '../components/home/HeroBombPreview';
import { LiveGameCard } from '../components/home/LiveGameCard';
import { FeaturedGameCard } from '../components/home/FeaturedGameCard';
import { SectionHeading } from '../components/SectionHeading';
import { FEATURED_GAMES } from '../data/demo';
import { useLeaderboard } from '../contexts/LeaderboardContext';
import { subscribePublicParties } from '../lib/party';
import { computeEscrowPool, ENTRY_LAMPORTS } from '../lib/escrow';
import type { PublicPartyListing } from '../types/party';
import { formatSol } from '../utils/format';
import { SITE_NAME, SITE_TAGLINE, SITE_TITLE } from '../lib/brand';

const LIVE_SLUGS = new Set(['tower', 'bomb-party']);

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0 },
};

export function HomePage() {
  const navigate = useNavigate();
  const { entries, highlights } = useLeaderboard();
  const topFive = entries.slice(0, 5);
  const [publicParties, setPublicParties] = useState<PublicPartyListing[]>([]);

  useEffect(() => subscribePublicParties(setPublicParties), []);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      {/* HERO */}
      <section className="relative grid items-center gap-8 py-10 lg:grid-cols-2 lg:py-16">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-grid opacity-40" />
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className="inline-flex items-center gap-2 rounded-full border border-neon-magenta/40 bg-ink-850 px-3 py-1.5 font-display text-[10px] uppercase tracking-widest text-neon-magenta"
          >
            <FlameIcon className="h-3.5 w-3.5" /> Live now · Bomb Party + Tower
          </motion.div>

          <h1 className="mt-5">
            <span className="sr-only">{SITE_TITLE}</span>
            <Logo className="[&_img]:h-12 sm:[&_img]:h-16" />
          </h1>
          <p className="mt-4 font-display text-lg uppercase tracking-wide text-white/80">
            {SITE_TAGLINE}
          </p>
          <p className="mt-3 max-w-md text-white/55">
            Fast multiplayer games. Stake SOL. Winner takes the pot. Bomb Party and Tower are live.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => navigate('/play')}>
              <PlayIcon className="h-5 w-5" /> Play
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate('/leaderboard')}>
              <TrophyIcon className="h-5 w-5" /> Leaderboard
            </Button>
          </div>
          <p className="mt-5 text-[11px] uppercase tracking-widest text-white/25">
            Choose your game on {SITE_NAME}
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        >
          <HeroBombPreview />
        </motion.div>
      </section>

      <section className="pb-4">
        <button
          type="button"
          onClick={() => navigate('/play/tower')}
          className="group relative flex w-full flex-col overflow-hidden rounded-2xl border border-neon-cyan/40 bg-ink-850 p-6 text-left sm:flex-row sm:items-center sm:justify-between sm:p-8"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{ background: 'radial-gradient(circle at 90% 50%, rgba(34,229,255,0.22), transparent 55%)' }}
          />
          <div className="relative">
            <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-cyan">
              New · CLASHR: TOWER
            </div>
            <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
              Climb. Shove. Survive.
            </h2>
            <p className="mt-2 max-w-xl text-sm text-white/55">
              Race 10 players up a collapsing neon tower. Shove rivals off ledges. First to the WIN pad takes
              the demo prize pool.
            </p>
          </div>
          <div className="relative mt-5 shrink-0 sm:mt-0">
            <span className="inline-flex items-center gap-2 rounded-xl bg-neon-cyan px-5 py-3 font-display text-sm font-semibold uppercase tracking-wide text-ink-950 shadow-glow-cyan group-hover:brightness-110">
              <PlayIcon className="h-4 w-4" /> Play Tower
            </span>
          </div>
        </button>
      </section>

      {/* LIVE NOW — real public parties only */}
      <section className="py-10">
        <SectionHeading
          kicker="Happening right now"
          title="Live Now"
          accent="#ff2ea8"
          action={{ label: 'All games', to: '/play' }}
        />
        {publicParties.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-850 px-6 py-12 text-center">
            <p className="font-display text-sm uppercase tracking-widest text-white/40">
              No public matches right now
            </p>
            <p className="mt-2 text-sm text-white/45">
              Create a public party in the lobby and it will show up here.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button onClick={() => navigate('/play/tower')}>
                <PlayIcon className="h-4 w-4" /> Play Tower
              </Button>
              <Button variant="secondary" onClick={() => navigate('/play/bomb-party')}>
                Bomb Party lobby
              </Button>
            </div>
          </div>
        ) : (
          <motion.div
            variants={{ show: { transition: { staggerChildren: 0.05 } } }}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {publicParties.map((p) => {
              const stake = p.entryLamports ?? ENTRY_LAMPORTS;
              const pool = computeEscrowPool(p.memberCount, stake);
              return (
                <motion.div
                  key={p.id}
                  variants={fadeUp}
                  transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
                >
                  <LiveGameCard
                    href={`/party/${p.id}?game=${p.gameSlug ?? 'bomb-party'}&cap=${p.capacity}&host=${encodeURIComponent(p.hostId)}&vis=public&stake=${stake}`}
                    game={{
                      id: p.id,
                      name: `${p.gameSlug === 'tower' ? 'Tower' : 'Bomb Party'} ${p.id}`,
                      players: p.memberCount,
                      capacity: p.capacity,
                      prizePool: pool.prizePool,
                      status: 'filling',
                      countdown: 0,
                    }}
                  />
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </section>

      {/* FEATURED GAMES */}
      <section className="py-10">
        <SectionHeading kicker="The lineup" title="Featured Games" accent="#22e5ff" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {FEATURED_GAMES.map((g) =>
            g.slug === 'tower' ? (
              <button
                key="tower-live"
                type="button"
                onClick={() => navigate('/play/tower')}
                className="group relative flex aspect-[3/4] flex-col justify-between overflow-hidden rounded-2xl border border-neon-cyan p-5 text-left"
                style={{ backgroundColor: '#0b0b15' }}
              >
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{ background: 'radial-gradient(circle at 50% 120%, rgba(34,229,255,0.35), transparent 65%)' }}
                />
                <div className="relative flex items-start justify-between">
                  <span className="text-5xl">🗼</span>
                  <span className="rounded-lg bg-neon-cyan px-2 py-1 font-display text-[9px] uppercase tracking-widest text-ink-950">
                    Live
                  </span>
                </div>
                <div className="relative">
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-white text-glow-cyan">
                    Tower
                  </h3>
                  <p className="mt-1 text-xs text-white/50">Climb. Shove. Survive.</p>
                  <div className="mt-4 rounded-xl bg-neon-cyan py-2.5 text-center font-display text-xs font-semibold uppercase tracking-widest text-ink-950">
                    Play Tower
                  </div>
                </div>
              </button>
            ) : (
              <FeaturedGameCard
                key={g.slug}
                game={LIVE_SLUGS.has(g.slug) ? { ...g, status: 'playable' } : g}
              />
            ),
          )}
        </div>
      </section>

      {/* LEADERBOARD PREVIEW */}
      <section className="py-10">
        <SectionHeading kicker="Today's champions" title="Leaderboard" accent="#b2ff59" action={{ label: 'Full board', to: '/leaderboard' }} />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-ink-600 bg-ink-850 p-5 lg:col-span-2">
            {topFive.length === 0 ? (
              <p className="py-8 text-center text-sm text-white/40">
                No wins recorded yet — play Bomb Party to climb the board.
              </p>
            ) : (
              <div className="space-y-1">
                {topFive.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-ink-800">
                    <span className="w-6 text-center font-display text-sm font-bold text-white/40">{e.rank}</span>
                    <span className="grid h-9 w-9 place-items-center rounded-lg text-lg" style={{ border: `1px solid ${e.color}66` }}>
                      {e.avatar}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-sm font-semibold text-white">
                        {e.username}
                      </span>
                    </span>
                    <span className="hidden text-xs text-white/40 sm:block">{e.wins} wins</span>
                    <span className="font-display text-sm text-neon-amber tabular-nums">
                      {e.biggestWin > 0 ? formatSol(e.biggestWin) : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
            <StatTile
              label="Biggest win"
              value={highlights.biggestWin && highlights.biggestWin.biggestWin > 0 ? formatSol(highlights.biggestWin.biggestWin) : '—'}
              sub={highlights.biggestWin ? highlights.biggestWin.username : 'Play to set a record'}
              accent="#ffb020"
            />
            <StatTile
              label="Most games played"
              value={highlights.mostGames ? String(highlights.mostGames.gamesPlayed) : '—'}
              sub={highlights.mostGames ? highlights.mostGames.username : undefined}
              accent="#a06bff"
            />
            <StatTile
              label="Longest streak"
              value={highlights.longestStreak ? `${highlights.longestStreak.streak}` : '—'}
              sub={highlights.longestStreak ? highlights.longestStreak.username : undefined}
              accent="#22e5ff"
            />
          </div>
        </div>
      </section>

      <footer className="flex flex-col items-center gap-2 border-t border-ink-700 py-8 text-center text-[11px] uppercase tracking-widest text-white/25">
        <span>
          {SITE_NAME} · {SITE_TAGLINE} · Pots paid in SOL
        </span>
      </footer>
    </div>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-850 p-4">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
      {sub && <div className="text-xs text-white/50">{sub}</div>}
    </div>
  );
}
