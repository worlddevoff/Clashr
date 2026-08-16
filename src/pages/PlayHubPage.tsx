import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayIcon } from 'lucide-react';
import { FEATURED_GAMES } from '../data/demo';
import { buttonClasses } from '../components/ui/buttonClasses';
import { ACCENT_HEX } from '../utils/cn';
import { playPath } from '../../shared/games';
import type { GameSlug } from '../../shared/games';
import { subscribePublicParties } from '../lib/party';
import type { PublicPartyListing } from '../types/party';
import { OpenTables } from '../components/home/OpenTables';

export function PlayHubPage() {
  const navigate = useNavigate();
  const playable = FEATURED_GAMES.filter((g) => g.status === 'playable');
  const [publicParties, setPublicParties] = useState<PublicPartyListing[]>([]);

  useEffect(() => subscribePublicParties(setPublicParties), []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-cyan">CLASHR</div>
      <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-white">Choose a game</h1>
      <p className="mt-2 text-sm text-white/55">Bomb Party and Tower are live. More arenas coming soon.</p>
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {playable.map((g) => {
          const accent = ACCENT_HEX[g.accent];
          return (
            <button
              key={g.slug}
              type="button"
              onClick={() => navigate(playPath(g.slug as GameSlug))}
              className="rounded-2xl border bg-ink-850 p-6 text-left transition hover:-translate-y-1"
              style={{ borderColor: `${accent}55` }}
            >
              <div className="text-5xl">{g.emoji}</div>
              <h2 className="mt-3 font-display text-2xl font-bold uppercase text-white">{g.name}</h2>
              <p className="mt-1 text-sm text-white/50">{g.tagline}</p>
              <div className="mt-4">
                <span className={buttonClasses({ size: 'sm' })}>
                  <PlayIcon className="h-4 w-4" /> Play {g.name}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="-mx-4 mt-4 sm:-mx-6">
        <OpenTables parties={publicParties} />
      </div>
    </div>
  );
}
