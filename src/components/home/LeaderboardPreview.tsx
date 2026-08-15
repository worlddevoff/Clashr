import { ArrowRightIcon, FlameIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatSol } from '../../utils/format';
import type { LeaderboardEntryView } from '../../lib/leaderboard';
import { cn } from '../../utils/cn';

export function LeaderboardPreview({
  entries,
  highlights,
}: {
  entries: LeaderboardEntryView[];
  highlights: {
    biggestWin?: LeaderboardEntryView | null;
    mostGames?: LeaderboardEntryView | null;
    longestStreak?: LeaderboardEntryView | null;
  };
}) {
  const top = entries.slice(0, 7);
  const records = [
    {
      label: 'Biggest single win',
      value:
        highlights.biggestWin && highlights.biggestWin.biggestWin > 0
          ? formatSol(highlights.biggestWin.biggestWin)
          : '—',
      holder: highlights.biggestWin?.username ?? 'Play to set a record',
      tone: 'text-neon-magenta',
    },
    {
      label: 'Most games played',
      value: highlights.mostGames ? String(highlights.mostGames.gamesPlayed) : '—',
      holder: highlights.mostGames?.username ?? '—',
      tone: 'text-neon-cyan',
    },
    {
      label: 'Longest win streak',
      value: highlights.longestStreak ? String(highlights.longestStreak.streak) : '—',
      holder: highlights.longestStreak?.username ?? '—',
      tone: 'text-neon-lime',
    },
  ];

  return (
    <section
      id="leaderboard"
      className="border-t border-line bg-ink-900/40 py-16 lg:py-20"
      aria-labelledby="leaderboard-heading"
    >
      <div className="mx-auto w-full max-w-[1240px] px-5 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow text-neon-magenta">Who is taking the money</p>
            <h2
              id="leaderboard-heading"
              className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl"
            >
              Leaderboard
            </h2>
          </div>
          <Link
            to="/leaderboard"
            className="flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-white"
          >
            View full board
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.7fr_1fr]">
          <div className="overflow-hidden rounded-xl border border-line bg-ink-900">
            <div className="grid grid-cols-[2rem_1fr_3.5rem_5rem] gap-4 border-b border-line px-5 py-3 eyebrow text-muted sm:grid-cols-[2rem_1fr_4rem_4rem_5.5rem]">
              <span>#</span>
              <span>Player</span>
              <span className="text-right">Wins</span>
              <span className="hidden text-right sm:block">Streak</span>
              <span className="text-right">Earned</span>
            </div>
            {top.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted">No wins recorded yet — play to climb the board.</p>
            ) : (
              <ul className="divide-y divide-line">
                {top.map((player) => (
                  <li
                    key={player.id}
                    className={cn(
                      'grid grid-cols-[2rem_1fr_3.5rem_5rem] items-center gap-4 px-5 py-3.5 transition-colors duration-150 ease-snap hover:bg-white/[0.04] sm:grid-cols-[2rem_1fr_4rem_4rem_5.5rem]',
                      player.rank === 1 && 'bg-neon-magenta/[0.06]',
                    )}
                  >
                    <span
                      className={cn(
                        'font-display text-sm font-semibold',
                        player.rank <= 3 ? 'text-white' : 'text-muted',
                      )}
                    >
                      {player.rank}
                    </span>
                    <span className="flex items-center gap-3">
                      <span
                        className="grid h-8 w-8 place-items-center rounded-md text-lg"
                        style={{ backgroundColor: `${player.color}22`, border: `1px solid ${player.color}66` }}
                      >
                        {player.avatar}
                      </span>
                      <span>
                        <span
                          className={cn(
                            'block truncate',
                            player.rank === 1
                              ? 'font-display text-base font-semibold uppercase tracking-wide text-white'
                              : 'text-sm text-white',
                          )}
                        >
                          {player.username}
                        </span>
                        <span className="block text-xs text-muted">{player.gamesPlayed} matches</span>
                      </span>
                    </span>
                    <span className="text-right text-sm tabular-nums text-white">{player.wins}</span>
                    <span className="hidden justify-end text-right text-sm tabular-nums sm:flex">
                      {player.streak > 0 ? (
                        <span className="flex items-center gap-1 text-neon-soft">
                          <FlameIcon className="h-3.5 w-3.5" />
                          {player.streak}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </span>
                    <span className="text-right font-display text-sm font-semibold tabular-nums text-neon-lime">
                      {player.biggestWin > 0 ? formatSol(player.biggestWin) : '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="eyebrow text-muted">Records held</h3>
            <dl className="mt-3 divide-y divide-line border-t border-line">
              {records.map((record) => (
                <div key={record.label} className="flex items-baseline justify-between gap-4 py-5">
                  <div>
                    <dt className="text-sm text-white">{record.label}</dt>
                    <p className="mt-0.5 text-xs text-muted">{record.holder}</p>
                  </div>
                  <dd className={cn('font-display text-2xl font-bold', record.tone)}>{record.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
