import { BellIcon, BombIcon, GrabIcon, PlayIcon, RocketIcon, BanknoteIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FEATURED_GAMES } from '../../data/demo';
import { Button } from '../ui/Button';
import { playPath } from '../../../shared/games';
import type { GameSlug } from '../../../shared/games';

const upcomingIcons: Record<string, typeof BanknoteIcon> = {
  'floor-is-cash': BanknoteIcon,
  'claw-chaos': GrabIcon,
  'rocket-run': RocketIcon,
};

export function GameLineup() {
  const navigate = useNavigate();
  const live = FEATURED_GAMES.filter((g) => g.status === 'playable');
  const upcoming = FEATURED_GAMES.filter((g) => g.status !== 'playable');
  const [feature, second] = live;

  return (
    <section id="lineup" className="border-y border-line bg-ink-900/40 py-16 lg:py-20" aria-labelledby="lineup-heading">
      <div className="mx-auto w-full max-w-[1240px] px-5 lg:px-8">
        <p className="eyebrow text-neon-cyan">The lineup</p>
        <h2
          id="lineup-heading"
          className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl"
        >
          Two games live, three loading
        </h2>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {feature && (
            <article className="group relative flex flex-col overflow-hidden rounded-xl border border-neon-cyan/25 bg-ink-900 lg:col-span-2">
              {feature.image ? (
                <img src={feature.image} alt={`${feature.name} gameplay`} className="h-56 w-full object-cover sm:h-72" />
              ) : (
                <div className="grid h-56 place-items-center bg-ink-850 text-6xl sm:h-72">{feature.emoji}</div>
              )}
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-2xl font-bold uppercase tracking-tight text-white">{feature.name}</h3>
                  <span className="rounded-full bg-neon-cyan/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neon-cyan">
                    Live
                  </span>
                </div>
                <p className="mt-1 font-display text-sm uppercase tracking-wider text-neon-cyan/80">{feature.tagline}</p>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">{feature.description}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-6 gap-y-3 pt-6">
                  <Button
                    className="rounded-md bg-neon-cyan text-ink-950 shadow-none hover:bg-neon-cyan"
                    onClick={() => navigate(playPath(feature.slug as GameSlug))}
                  >
                    <PlayIcon className="h-4 w-4" /> Play {feature.name}
                  </Button>
                  {feature.players && <span className="text-xs text-muted">{feature.players}</span>}
                  {feature.stakeRange && <span className="text-xs text-muted">{feature.stakeRange}</span>}
                </div>
              </div>
            </article>
          )}

          {second && (
            <article className="flex flex-col overflow-hidden rounded-xl border border-line bg-ink-900">
              {second.image ? (
                <img src={second.image} alt={`${second.name} gameplay`} className="h-40 w-full object-cover" />
              ) : (
                <div className="grid h-40 place-items-center bg-ink-850 text-5xl">{second.emoji}</div>
              )}
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-3">
                  <h3 className="font-display text-xl font-bold uppercase tracking-tight text-white">{second.name}</h3>
                  <span className="rounded-full bg-neon-magenta/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neon-soft">
                    Live
                  </span>
                </div>
                <p className="mt-1 font-display text-sm uppercase tracking-wider text-neon-soft/80">{second.tagline}</p>
                <p className="mt-3 text-sm leading-relaxed text-muted">{second.description}</p>
                <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-3 pt-6">
                  <Button className="rounded-md" onClick={() => navigate(playPath(second.slug as GameSlug))}>
                    <BombIcon className="h-4 w-4" /> Play {second.name}
                  </Button>
                  {second.players && <span className="text-xs text-muted">{second.players}</span>}
                </div>
              </div>
            </article>
          )}
        </div>

        <h3 className="mt-12 eyebrow text-muted">In development</h3>
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {upcoming.map((game) => {
            const Icon = upcomingIcons[game.slug] ?? RocketIcon;
            return (
              <li key={game.slug} className="flex flex-wrap items-center gap-4 py-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-ink-850">
                  <Icon className="h-4 w-4 text-muted" />
                </span>
                <span className="min-w-[140px]">
                  <span className="block font-display text-sm font-semibold uppercase tracking-wide text-white">
                    {game.name}
                  </span>
                  <span className="block text-xs text-muted">{game.tagline}</span>
                </span>
                <p className="flex-1 text-sm text-muted">{game.description}</p>
                <span className="inline-flex items-center gap-2 rounded-md border border-line px-3.5 py-2 text-xs font-medium text-muted">
                  <BellIcon className="h-3.5 w-3.5" /> Soon
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
