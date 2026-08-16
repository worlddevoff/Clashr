import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  UsersIcon,
  ClockIcon,
  AlertTriangleIcon,
  PlusIcon,
  UserPlusIcon,
  GlobeIcon,
  LockIcon,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { StakePicker } from '../components/game/StakePicker';
import { useAuth } from '../contexts/AuthContext';
import { createParty, parsePartyCode, subscribePublicParties } from '../lib/party';
import { publishPartyState } from '../lib/partyRemote';
import {
  clampStakeLamports,
  computeEscrowPool,
  ENTRY_SOL,
  loadLastStakeSol,
  saveLastStakeSol,
  solToLamports,
} from '../lib/escrow';
import type { PartyCapacity, PartyVisibility, PublicPartyListing } from '../types/party';
import { formatDuration, formatSol } from '../utils/format';
import { CREDITS_DISCLAIMER, fetchTowerMe, loginTowerServer } from '../lib/towerApi';
import { useSolPots } from '../contexts/SolPotsContext';
import { cn } from '../utils/cn';

const TOWER_CAPS = [2, 5, 10] as const satisfies readonly PartyCapacity[];

const PRACTICE_ROOMS: { capacity: PartyCapacity; estDurationSec: number }[] = [
  { capacity: 2, estDurationSec: 45 },
  { capacity: 5, estDurationSec: 75 },
  { capacity: 10, estDurationSec: 110 },
];

export function TowerLobbyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [createCap, setCreateCap] = useState<PartyCapacity>(10);
  const [stakeSol, setStakeSol] = useState(loadLastStakeSol);
  const [joinCode, setJoinCode] = useState('');
  const [publicParties, setPublicParties] = useState<PublicPartyListing[]>([]);
  const [busy, setBusy] = useState(false);
  const potsOn = useSolPots();

  useEffect(
    () =>
      subscribePublicParties((list) =>
        setPublicParties(list.filter((party) => party.gameSlug === 'tower')),
      ),
    [],
  );

  const ensureServer = async () => {
    if (!user) return null;
    const existing = await fetchTowerMe();
    if (existing) return existing;
    return loginTowerServer({
      address: user.walletAddress,
      username: user.username,
      avatar: user.avatar,
      color: user.color,
    });
  };

  const createTowerParty = async (visibility: PartyVisibility, capacity = createCap) => {
    if (!user) {
      setError('Connect a wallet to create a party.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const entryLamports = potsOn ? clampStakeLamports(solToLamports(stakeSol)) : undefined;
      if (potsOn) saveLastStakeSol(stakeSol);
      const party = createParty({
        gameSlug: 'tower',
        capacity,
        visibility,
        entryLamports,
        host: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
          color: user.color,
        },
      });
      void publishPartyState(party);
      const stakeQ = entryLamports ? `&stake=${entryLamports}` : '';
      navigate(
        `/party/${party.id}?game=tower&cap=${capacity}&host=${encodeURIComponent(party.hostId)}&vis=${visibility}${stakeQ}`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create this lobby.');
    } finally {
      setBusy(false);
    }
  };

  const joinPublic = (listing: PublicPartyListing) => {
    if (!user) {
      setError('Connect a wallet to join a party.');
      return;
    }
    setError(null);
    const stake = listing.entryLamports ?? solToLamports(ENTRY_SOL);
    navigate(
      `/party/${listing.id}?game=tower&cap=${listing.capacity}&host=${encodeURIComponent(listing.hostId)}&vis=public&stake=${stake}`,
    );
  };

  const joinByCode = () => {
    if (!user) {
      setError('Connect a wallet to join a Tower party.');
      return;
    }
    const code = parsePartyCode(joinCode);
    if (!code) {
      setError('Enter a valid Tower party code.');
      return;
    }
    navigate(`/party/${code}?game=tower&cap=${createCap}`);
  };

  const playPractice = (capacity: PartyCapacity) => {
    if (!user) {
      setError('Connect a wallet to play — including free games.');
      return;
    }
    navigate(`/game/tower/practice?practice=1&cap=${capacity}`);
  };

  const quickMatch = async () => {
    if (!user) {
      setError('Connect a wallet to play — including free games.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureServer();
      navigate('/game/tower/quick');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Server login failed');
    } finally {
      setBusy(false);
    }
  };

  const fullPot = computeEscrowPool(createCap, solToLamports(stakeSol));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-cyan">
            CLASHR: TOWER
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-white sm:text-4xl">
            Tower Lobby
          </h1>
          <p className="mt-1 text-sm text-white/55">
            Practice vs bots for free, or create a public or private party.{' '}
            <button type="button" className="text-neon-cyan underline" onClick={() => navigate('/play')}>
              All games
            </button>
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-widest text-neon-amber">{CREDITS_DISCLAIMER}</p>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <section className="mb-10">
        <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-lime">
          {potsOn ? 'SOL parties' : 'Parties'}
        </div>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase text-white">
          Create or join a lobby
        </h2>
        <p className="mt-2 text-sm text-white/50">
          {potsOn
            ? 'Public and private Tower parties use the same on-chain escrow as Bomb Party. Every connected wallet stakes before the host can start; bots never stake.'
            : 'Public and private Tower parties are free until the house oracle can settle pots. Every connected wallet can join; bots fill empty seats.'}
        </p>

        <div className="mt-5 rounded-2xl border border-neon-amber/25 bg-ink-850 p-5">
          {potsOn && (
            <StakePicker
              valueSol={stakeSol}
              onChange={(value) => {
                setStakeSol(value);
                saveLastStakeSol(value);
              }}
              disabled={!user}
              hint="Stake paid by each real player when a second wallet joins."
            />
          )}

          <div className={potsOn ? 'mt-5' : undefined}>
            <div className="mb-2 font-display text-[11px] uppercase tracking-widest text-white/45">
              Players
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TOWER_CAPS.map((cap) => (
                <button
                  key={cap}
                  type="button"
                  disabled={!user}
                  onClick={() => setCreateCap(cap)}
                  className={cn(
                    'rounded-xl border px-2 py-3 text-center transition-colors disabled:opacity-50',
                    createCap === cap
                      ? 'border-neon-cyan bg-ink-800 text-neon-cyan'
                      : 'border-ink-600 bg-ink-900 text-white/70 hover:border-white/30',
                  )}
                >
                  <div className="font-display text-2xl font-bold">{cap}</div>
                  <div className="text-[9px] uppercase tracking-widest text-white/40">players</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button size="lg" disabled={!user || busy} onClick={() => void createTowerParty('public')}>
              <GlobeIcon className="h-5 w-5" /> {busy ? 'Opening lobby…' : 'Create public lobby'}
            </Button>
            <Button size="lg" variant="secondary" disabled={!user || busy} onClick={() => void createTowerParty('private')}>
              <LockIcon className="h-5 w-5" /> Create private lobby
            </Button>
          </div>
          {potsOn && (
            <p className="mt-3 text-xs text-white/40">
              At {createCap} real players: {formatSol(fullPot.prizePool)} winner pot after the 5% platform
              fee.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            disabled={!user}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === 'Enter') joinByCode();
            }}
            placeholder="TOWER PARTY CODE"
            maxLength={8}
            className="min-w-0 flex-1 rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 font-display tracking-[0.18em] text-white outline-none placeholder:text-white/25 focus:border-neon-cyan disabled:opacity-50"
          />
          <Button variant="secondary" disabled={!user} onClick={joinByCode}>
            Join party
          </Button>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">
            Public Tower lobbies
          </h3>
          <p className="mt-0.5 text-xs text-white/35">
            Open lobbies wait for players until full — or the host starts with bots.
          </p>
        </div>
        <span className="text-xs text-white/35">
          {publicParties.length === 0 ? 'None open — create one' : `${publicParties.length} waiting`}
        </span>
      </div>
      {publicParties.length === 0 ? (
        <div className="mb-10 rounded-2xl border border-dashed border-ink-600 bg-ink-900/40 px-5 py-8 text-center">
          <GlobeIcon className="mx-auto h-6 w-6 text-white/25" />
          <p className="mt-2 text-sm text-white/45">No public Tower lobbies yet.</p>
          <Button className="mt-4" variant="secondary" disabled={!user} onClick={() => createTowerParty('public')}>
            <PlusIcon className="h-4 w-4" /> Create the first
          </Button>
        </div>
      ) : (
        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {publicParties.map((listing, i) => {
            const stake = listing.entryLamports ?? solToLamports(ENTRY_SOL);
            const pot = computeEscrowPool(Math.max(2, listing.memberCount), stake);
            const seats = Math.max(0, listing.capacity - listing.memberCount);
            return (
              <motion.div
                key={listing.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, delay: i * 0.03 }}
                className="rounded-2xl border border-neon-cyan/25 bg-ink-850 p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display text-lg font-bold text-white">{listing.id}</div>
                    <div className="text-xs text-white/45">Host {listing.hostName}</div>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-neon-cyan">
                    <UsersIcon className="h-4 w-4" />
                    {listing.memberCount}/{listing.capacity}
                  </span>
                </div>
                <div className="mt-3 text-xs text-neon-lime">
                  {potsOn
                    ? `${formatSol(stake / 1e9)} each · current pot ${formatSol(pot.prizePool)}`
                    : `${seats} seat${seats === 1 ? '' : 's'} open`}
                </div>
                <Button className="mt-4 w-full" disabled={!user || seats <= 0} onClick={() => joinPublic(listing)}>
                  {seats <= 0 ? 'Full' : 'Join Tower lobby'}
                </Button>
              </motion.div>
            );
          })}
        </div>
      )}

      <div className="mb-4">
        <div className="font-display text-[11px] uppercase tracking-[0.22em] text-white/40">Solo vs bots</div>
        <p className="mt-0.5 text-xs text-white/35">
          Practice vs bots is free. Parties are wallet-gated. Quick match uses the server and demo credits.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PRACTICE_ROOMS.map((room, i) => (
          <motion.div
            key={room.capacity}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: i * 0.04, ease: [0.23, 1, 0.32, 1] }}
            whileHover={{ y: -5 }}
            className="flex flex-col overflow-hidden rounded-2xl border border-ink-600 bg-ink-850"
          >
            <div className="relative border-b border-ink-700 bg-ink-900 p-5 text-center">
              <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
              <div className="relative font-display text-5xl font-bold text-neon-cyan text-glow-cyan">
                {room.capacity}
              </div>
              <div className="relative mt-1 font-display text-[10px] uppercase tracking-[0.3em] text-white/40">
                Player arena
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-5">
              <Row
                label="Entry"
                value={<span className="font-display text-sm uppercase tracking-wide text-white/40">Free</span>}
              />
              <Row
                label="Prize"
                value={
                  <span className="font-display text-sm uppercase tracking-wide text-white/40">None · practice</span>
                }
              />
              <div className="flex items-center justify-between text-xs text-white/45">
                <span className="inline-flex items-center gap-1">
                  <UsersIcon className="h-3.5 w-3.5" /> bots fill seats
                </span>
                <span className="inline-flex items-center gap-1">
                  <ClockIcon className="h-3.5 w-3.5" /> ~{formatDuration(room.estDurationSec)}
                </span>
              </div>
              <div className="mt-auto flex flex-col gap-2">
                <Button className="w-full" onClick={() => playPractice(room.capacity)}>
                  Play solo
                </Button>
                {room.capacity === 10 && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={busy || !user}
                    onClick={() => void quickMatch()}
                  >
                    {user ? 'Quick match · server' : 'Connect for quick match'}
                  </Button>
                )}
                <Button
                  className="w-full"
                  variant="secondary"
                  disabled={!user}
                  onClick={() => createTowerParty('private', room.capacity)}
                >
                  <UserPlusIcon className="h-4 w-4" /> Party · set stake
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-widest text-white/40">{label}</span>
      {value}
    </div>
  );
}
