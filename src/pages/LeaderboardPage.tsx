import type { ComponentType } from 'react';
import { motion } from 'framer-motion';
import { TrophyIcon, FlameIcon, Gamepad2Icon } from 'lucide-react';
import { useLeaderboard } from '../contexts/LeaderboardContext';
import { formatSol, winRate } from '../utils/format';
import type { LeaderboardEntryView } from '../lib/leaderboard';
import { cn } from '../utils/cn';
import { CREDITS_DISCLAIMER } from '../lib/towerApi';

export function LeaderboardPage() {
  const { entries, highlights } = useLeaderboard();
  const top = entries;
  const podium = [top[1], top[0], top[2]].filter(Boolean) as LeaderboardEntryView[];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-lime">Live</div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
          Leaderboard
        </h1>
        <p className="mt-1 text-sm text-white/50">Ranked by wins from connected wallets.</p>
        <p className="mt-2 text-[10px] uppercase tracking-widest text-white/35">{CREDITS_DISCLAIMER}</p>
      </div>

      {top.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-600 bg-ink-850 px-6 py-16 text-center">
          <div className="text-4xl">🏆</div>
          <h2 className="mt-3 font-display text-xl font-bold uppercase text-white">No results yet</h2>
          <p className="mt-2 text-sm text-white/50">
            Play with your wallet — only real players show up here.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Highlight
              icon={TrophyIcon}
              label="Biggest win"
              value={highlights.biggestWin && highlights.biggestWin.biggestWin > 0 ? formatSol(highlights.biggestWin.biggestWin) : '—'}
              sub={highlights.biggestWin ? displayName(highlights.biggestWin) : '—'}
              accent="#ffb020"
            />
            <Highlight
              icon={Gamepad2Icon}
              label="Most games"
              value={highlights.mostGames ? String(highlights.mostGames.gamesPlayed) : '—'}
              sub={highlights.mostGames ? displayName(highlights.mostGames) : '—'}
              accent="#a06bff"
            />
            <Highlight
              icon={FlameIcon}
              label="Longest streak"
              value={highlights.longestStreak ? String(highlights.longestStreak.streak) : '—'}
              sub={highlights.longestStreak ? displayName(highlights.longestStreak) : '—'}
              accent="#ff2b2b"
            />
          </div>

          {podium.length > 0 && (
            <div className="mb-4 grid grid-cols-3 items-end gap-3">
              {podium.map((e, idx) => {
                const heights = ['h-24', 'h-32', 'h-20'];
                const place = e.rank;
                const heightClass = heights[Math.min(idx, 2)];
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: idx * 0.06, ease: [0.23, 1, 0.32, 1] }}
                    className="flex flex-col items-center"
                  >
                    <span
                      className="grid h-12 w-12 place-items-center rounded-2xl text-2xl"
                      style={{ border: `2px solid ${e.color}`, boxShadow: `0 0 16px ${e.color}66` }}
                    >
                      {e.avatar}
                    </span>
                    <span className="mt-2 truncate font-display text-xs font-semibold text-white">
                      {displayName(e)}
                    </span>
                    <span className="font-display text-[10px] text-neon-amber">
                      {e.biggestWin > 0 ? formatSol(e.biggestWin) : '—'}
                    </span>
                    <div
                      className={`mt-2 w-full ${heightClass} rounded-t-xl border-t-2 border-ink-600 bg-ink-850`}
                      style={{ borderColor: `${e.color}66` }}
                    >
                      <div className="pt-2 text-center font-display text-2xl font-bold text-white/30">
                        {place}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-850">
            <div className="hidden grid-cols-12 gap-2 border-b border-ink-700 px-4 py-3 font-display text-[10px] uppercase tracking-widest text-white/35 sm:grid">
              <span className="col-span-1">#</span>
              <span className="col-span-4">Player</span>
              <span className="col-span-2 text-right">Wins</span>
              <span className="col-span-2 text-right">Win rate</span>
              <span className="col-span-3 text-right">Biggest win</span>
            </div>
            {top.map((e) => (
              <div
                key={e.id}
                className="grid grid-cols-12 items-center gap-2 border-b border-ink-700/60 px-4 py-3 last:border-0 hover:bg-ink-800"
              >
                <span className="col-span-2 font-display text-sm font-bold text-white/40 sm:col-span-1">
                  {e.rank}
                </span>
                <span className="col-span-7 flex items-center gap-2.5 sm:col-span-4">
                  <span
                    className="grid h-8 w-8 place-items-center rounded-lg text-base"
                    style={{ border: `1px solid ${e.color}66` }}
                  >
                    {e.avatar}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm font-semibold text-white">
                      {displayName(e)}
                    </span>
                  </span>
                </span>
                <span className="col-span-3 text-right font-display text-sm text-white sm:col-span-2">
                  {e.wins}
                </span>
                <span className="hidden text-right text-sm text-white/60 sm:col-span-2 sm:block">
                  {winRate(e.wins, e.gamesPlayed)}%
                </span>
                <span
                  className={cn(
                    'col-span-12 text-right font-display text-sm text-neon-amber sm:col-span-3',
                  )}
                >
                  {e.biggestWin > 0 ? formatSol(e.biggestWin) : '—'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function displayName(e: { username: string }) {
  return e.username;
}

function Highlight({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 p-4">
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl"
        style={{ backgroundColor: accent }}
      />
      <Icon className="h-5 w-5" />
      <div className="mt-2 text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-0.5 font-display text-2xl font-bold" style={{ color: accent }}>
        {value}
      </div>
      <div className="text-xs text-white/50">{sub}</div>
    </div>
  );
}
