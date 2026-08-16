import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BombIcon,
  BotIcon,
  LockIcon,
  ShieldCheckIcon,
  TowerControlIcon,
  TrophyIcon,
  UsersIcon,
  WalletIcon,
} from 'lucide-react';
import { buttonClasses } from '../components/ui/buttonClasses';

const steps = [
  {
    icon: WalletIcon,
    title: 'Connect',
    body: 'Connect a Solana wallet to create or join multiplayer tables. Practice matches are free and need no deposit.',
  },
  {
    icon: UsersIcon,
    title: 'Choose a table',
    body: 'Join an open table, enter a private code, or host your own party. The host chooses the game and player count.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Lock the entry',
    body: 'When SOL pots are enabled, every real player posts the same entry into the match escrow before play begins.',
  },
  {
    icon: TrophyIcon,
    title: 'Play to win',
    body: 'The server runs the match, records the result, and settles the winner payout after the platform fee.',
  },
];

const games = [
  {
    icon: BombIcon,
    accent: 'text-neon-magenta',
    border: 'border-neon-magenta/30',
    title: 'Bomb Party',
    body: 'Pass the ticking bomb by colliding with another player. The holder is eliminated when the fuse expires, and the last player standing wins.',
    detail: 'As the arena walls close on the final three, passes stop resetting the fuse so the endgame cannot stall.',
    to: '/play/bomb-party',
  },
  {
    icon: TowerControlIcon,
    accent: 'text-neon-cyan',
    border: 'border-neon-cyan/30',
    title: 'Tower',
    body: 'Climb a hazard-filled tower and stay alive. Reach the top before your opponents to take the match.',
    detail: 'Movement, timing, and route choice decide the winner.',
    to: '/play/tower',
  },
];

export function HowItWorksPage() {
  return (
    <div className="w-full">
      <section className="border-b border-line bg-[radial-gradient(circle_at_top,rgba(34,229,255,0.12),transparent_48%)]">
        <div className="mx-auto max-w-[1100px] px-5 py-16 text-center sm:py-20 lg:px-8">
          <p className="eyebrow text-neon-lime">From lobby to payout</p>
          <h1 className="mt-3 font-display text-4xl font-bold uppercase tracking-tight text-white sm:text-6xl">
            How CLASHR works
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            Pick a fast competitive game, join a table, and fight for the win. Practice for free or play
            a SOL-backed match when pots are available.
          </p>
          <Link to="/play" className={buttonClasses({ size: 'lg', className: 'mt-8' })}>
            Choose a game <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-[1100px] px-5 py-14 lg:px-8 lg:py-20" aria-labelledby="match-flow">
        <p className="eyebrow text-neon-cyan">Match flow</p>
        <h2 id="match-flow" className="mt-2 font-display text-3xl font-bold uppercase text-white">
          Four steps to the arena
        </h2>
        <ol className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={step.title} className="rounded-2xl border border-line bg-ink-850 p-5">
                <div className="flex items-center justify-between">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-neon-cyan/10 text-neon-cyan">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="font-display text-xs text-white/25">0{index + 1}</span>
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold uppercase text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="border-y border-line bg-ink-900/60">
        <div className="mx-auto max-w-[1100px] px-5 py-14 lg:px-8 lg:py-20">
          <p className="eyebrow text-neon-magenta">The games</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase text-white">Know how to win</h2>
          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {games.map((game) => {
              const Icon = game.icon;
              return (
                <article key={game.title} className={`rounded-2xl border ${game.border} bg-ink-850 p-6 sm:p-7`}>
                  <Icon className={`h-8 w-8 ${game.accent}`} aria-hidden />
                  <h3 className="mt-5 font-display text-2xl font-bold uppercase text-white">{game.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/65">{game.body}</p>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{game.detail}</p>
                  <Link
                    to={game.to}
                    className={`mt-6 inline-flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide ${game.accent}`}
                  >
                    Play {game.title} <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-[1100px] gap-8 px-5 py-14 lg:grid-cols-2 lg:px-8 lg:py-20">
        <div>
          <p className="eyebrow text-neon-lime">Ways to play</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase text-white">Practice or compete</h2>
        </div>
        <div className="space-y-4">
          <div className="flex gap-4 rounded-2xl border border-line bg-ink-850 p-5">
            <BotIcon className="mt-0.5 h-6 w-6 shrink-0 text-neon-cyan" aria-hidden />
            <div>
              <h3 className="font-display text-base font-semibold uppercase text-white">Free practice</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Learn the controls against bots without staking SOL. Practice results do not create a payout.
              </p>
            </div>
          </div>
          <div className="flex gap-4 rounded-2xl border border-line bg-ink-850 p-5">
            <LockIcon className="mt-0.5 h-6 w-6 shrink-0 text-neon-magenta" aria-hidden />
            <div>
              <h3 className="font-display text-base font-semibold uppercase text-white">Public and private parties</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Open tables are visible to everyone. Private parties use an invite link or code and only start
                when the host is ready.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto max-w-[1100px] px-5 py-14 text-center lg:px-8">
          <h2 className="font-display text-3xl font-bold uppercase text-white">Ready to clash?</h2>
          <p className="mt-2 text-sm text-muted">Choose a game and enter the arena.</p>
          <Link to="/play" className={buttonClasses({ size: 'lg', className: 'mt-6' })}>
            Play now <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
