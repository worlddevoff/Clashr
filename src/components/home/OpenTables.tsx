import { ArrowRightIcon, BombIcon, PlusIcon, TowerControlIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import type { PublicPartyListing } from '../../types/party';
import { computeEscrowPool, ENTRY_LAMPORTS } from '../../lib/escrow';
import { solPotsEnabled } from '../../lib/solPots';
import { formatSol } from '../../utils/format';
import { cn } from '../../utils/cn';

function GameIcon({ slug }: { slug?: string }) {
  const isTower = slug === 'tower';
  const Icon = isTower ? TowerControlIcon : BombIcon;
  return <Icon className={cn('h-4 w-4', isTower ? 'text-neon-cyan' : 'text-neon-magenta')} aria-hidden />;
}

export function OpenTables({ parties }: { parties: PublicPartyListing[] }) {
  const navigate = useNavigate();

  return (
    <section id="open-tables" className="mx-auto w-full max-w-[1240px] px-5 py-16 lg:px-8 lg:py-20">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow text-neon-magenta">Happening right now</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
            Open tables
          </h2>
        </div>
        <Button variant="secondary" className="rounded-md" onClick={() => navigate('/play')}>
          <PlusIcon className="h-4 w-4 text-neon-lime" /> Host your own
        </Button>
      </div>

      {parties.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line bg-ink-900 px-6 py-12 text-center">
          <p className="font-display text-sm uppercase tracking-widest text-muted">No public matches right now</p>
          <p className="mt-2 text-sm text-muted">Create a public party in the lobby and it will show up here.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Button className="rounded-md" onClick={() => navigate('/play/tower')}>
              Play Tower
            </Button>
            <Button variant="secondary" className="rounded-md" onClick={() => navigate('/play/bomb-party')}>
              Bomb Party lobby
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 overflow-hidden rounded-xl border border-line bg-ink-900">
          <div className="hidden grid-cols-[1.4fr_0.8fr_0.9fr_1fr_auto] gap-4 border-b border-line px-5 py-3 eyebrow text-muted md:grid">
            <span>Table</span>
            <span>Stake</span>
            <span>Pot</span>
            <span>Seats</span>
            <span className="w-24 text-right">Join</span>
          </div>
          <ul className="divide-y divide-line">
            {parties.map((match) => {
              const seatsLeft = Math.max(0, match.capacity - match.memberCount);
              const filling = seatsLeft <= 1;
              const stake = match.entryLamports ?? ENTRY_LAMPORTS;
              const pot = solPotsEnabled() ? computeEscrowPool(match.memberCount, stake).prizePool : 0;
              const game = match.gameSlug === 'tower' ? 'Tower' : 'Bomb Party';
              const href = `/party/${match.id}?game=${match.gameSlug}&cap=${match.capacity}&host=${encodeURIComponent(match.hostId)}&vis=public&stake=${stake}`;
              return (
                <li
                  key={match.id}
                  className={cn(
                    'grid grid-cols-2 gap-4 px-5 py-4 transition-colors duration-150 ease-snap hover:bg-white/[0.04] md:grid-cols-[1.4fr_0.8fr_0.9fr_1fr_auto] md:items-center',
                    filling && 'bg-neon-magenta/[0.06]',
                  )}
                >
                  <div className="col-span-2 flex items-center gap-3 md:col-span-1">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md border border-line bg-ink-850">
                      <GameIcon slug={match.gameSlug} />
                    </span>
                    <span>
                      <span className="block font-display text-sm font-semibold uppercase tracking-wide text-white">
                        {game}
                      </span>
                      <span className="block text-xs text-muted">
                        {match.id} · hosted by {match.hostName}
                      </span>
                    </span>
                  </div>
                  <div>
                    <span className="eyebrow block text-muted md:hidden">Stake</span>
                    <span className="text-sm text-white">{formatSol(stake / 1e9)}</span>
                  </div>
                  <div>
                    <span className="eyebrow block text-muted md:hidden">Pot</span>
                    <span className="font-display text-sm font-semibold text-neon-lime">
                      {pot > 0 ? formatSol(pot) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="eyebrow block text-muted md:hidden">Seats</span>
                    <span className="flex items-center gap-2">
                      <span className="text-sm text-white">
                        {match.memberCount}/{match.capacity}
                      </span>
                      {filling && (
                        <span className="rounded-full bg-neon-magenta/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-neon-soft">
                          {seatsLeft === 0 ? 'Full' : '1 seat left'}
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block h-1 w-full max-w-[120px] overflow-hidden rounded-full bg-white/10">
                      <span
                        className={cn('block h-full rounded-full', filling ? 'bg-neon-magenta' : 'bg-neon-cyan')}
                        style={{ width: `${Math.min(100, (match.memberCount / match.capacity) * 100)}%` }}
                      />
                    </span>
                  </div>
                  <div className="col-span-2 flex items-center justify-end md:col-span-1">
                    <Button
                      size="sm"
                      variant={filling ? 'primary' : 'secondary'}
                      className="rounded-md"
                      disabled={seatsLeft <= 0}
                      onClick={() => navigate(href)}
                    >
                      Join
                      <ArrowRightIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="border-t border-line px-5 py-3.5 text-xs text-muted">
            Stakes are escrowed on-chain and released to the winner the moment a match ends.
          </p>
        </div>
      )}
    </section>
  );
}
