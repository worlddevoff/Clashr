import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogOutIcon, PlayIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { shortAddress } from '../lib/wallet';
import { loadMatchHistory } from '../lib/matchHistory';
import { formatSol, winRate } from '../utils/format';
import { cn } from '../utils/cn';

export function ProfilePage() {
  const { user, logOut } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  const xpPct = Math.min(100, Math.round((user.xp / user.xpToNext) * 100));
  const rate = winRate(user.wins, user.gamesPlayed);
  const recentGames = loadMatchHistory(user.walletAddress);
  const achievements = [
    { id: 'a1', label: 'First Blast', description: 'Play your first game', icon: '💥', unlocked: user.gamesPlayed >= 1 },
    { id: 'a4', label: 'Untouchable', description: 'Win 3 games in a row', icon: '🔥', unlocked: user.streak >= 3 },
    { id: 'a5', label: 'Arena Legend', description: 'Reach level 20', icon: '👑', unlocked: user.level >= 20 },
    { id: 'a6', label: 'Party Animal', description: 'Play 100 games', icon: '🎉', unlocked: user.gamesPlayed >= 100 },
    { id: 'a7', label: 'First Pot', description: 'Win a SOL pot', icon: '💰', unlocked: user.biggestWin > 0 },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="relative overflow-hidden rounded-3xl border border-ink-600 bg-ink-850 p-6"
      >
        <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(circle at 15% 0%, ${user.color}22, transparent 55%)` }}
        />
        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <span
            className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl text-5xl"
            style={{ border: `3px solid ${user.color}`, boxShadow: `0 0 26px ${user.color}66` }}
          >
            {user.avatar}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight text-white">
                @{user.username}
              </h1>
              <span className="rounded-md bg-ink-700 px-2 py-0.5 font-mono text-[10px] tracking-wide text-neon-cyan">
                {shortAddress(user.walletAddress)}
              </span>
            </div>
            <div className="mt-1 font-display text-xs uppercase tracking-wide" style={{ color: user.color }}>
              Level {user.level}
            </div>
            <div className="mt-3 max-w-sm">
              <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-white/40">
                <span>{user.xp} XP</span>
                <span>{user.xpToNext} XP</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-ink-700">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: user.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
                />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2">
            <div className="rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 text-center font-mono text-[11px] text-white/50">
              {user.walletAddress}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Games" value={String(user.gamesPlayed)} />
        <Stat label="Wins" value={String(user.wins)} accent="#b2ff59" />
        <Stat label="Win rate" value={`${rate}%`} accent="#22e5ff" />
        <Stat label="Biggest win" value={user.biggestWin > 0 ? formatSol(user.biggestWin) : '—'} accent="#ffb020" />
        <Stat label="Streak" value={`${user.streak}`} accent="#ff2ea8" />
        <Stat label="Level" value={String(user.level)} accent="#a06bff" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 font-display text-lg font-bold uppercase tracking-wide text-white">
            Achievements
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {achievements.map((a) => (
              <div
                key={a.id}
                className={cn(
                  'rounded-2xl border p-4 text-center',
                  a.unlocked ? 'border-ink-600 bg-ink-850' : 'border-ink-700 bg-ink-900 opacity-50',
                )}
              >
                <div className={cn('text-3xl', !a.unlocked && 'grayscale')}>{a.icon}</div>
                <div className="mt-2 font-display text-xs font-semibold uppercase tracking-wide text-white">
                  {a.label}
                </div>
                <div className="mt-0.5 text-[10px] text-white/45">{a.description}</div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white">
              Recent games
            </h2>
            <Button size="sm" onClick={() => navigate('/play')}>
              <PlayIcon className="h-4 w-4" /> Play
            </Button>
          </div>
          <div className="overflow-hidden rounded-2xl border border-ink-600 bg-ink-850">
            {recentGames.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-white/40">
                No matches yet. Play Bomb Party and results show up here.
              </div>
            ) : (
              recentGames.map((g) => (
                <div
                  key={`${g.gameNumber}-${g.at}`}
                  className="flex items-center justify-between border-b border-ink-700/60 px-4 py-3 last:border-0"
                >
                  <span className="font-display text-sm text-white">Bomb Party #{g.gameNumber}</span>
                  <span
                    className={cn(
                      'font-display text-xs uppercase tracking-wide',
                      g.won ? 'text-neon-lime' : 'text-white/40',
                    )}
                  >
                    {g.practice ? 'Practice' : g.won ? 'Won' : 'Lost'}
                  </span>
                  <span
                    className={cn(
                      'font-display text-sm tabular-nums',
                      g.prize > 0 ? 'text-neon-lime' : g.prize < 0 ? 'text-red-400' : 'text-white/35',
                    )}
                  >
                    {g.prize === 0
                      ? '—'
                      : `${g.prize > 0 ? '+' : '−'}${formatSol(Math.abs(g.prize))}`}
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={logOut}
            className="mt-4 inline-flex items-center gap-2 font-display text-xs uppercase tracking-wide text-white/40 transition-colors hover:text-red-400"
          >
            <LogOutIcon className="h-4 w-4" /> Log out
          </button>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = '#f4f4fb' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-850 p-4">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-1 font-display text-xl font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
