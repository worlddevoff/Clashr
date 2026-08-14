import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GlobeIcon, LockIcon, PlusIcon, UsersIcon } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { StakePicker } from '../components/game/StakePicker';
import { useAuth } from '../contexts/AuthContext';
import {
  createParty,
  parsePartyCode,
  subscribePublicParties,
} from '../lib/party';
import {
  clampStakeLamports,
  computeEscrowPool,
  loadLastStakeSol,
  saveLastStakeSol,
  solToLamports,
} from '../lib/escrow';
import type {
  PartyCapacity,
  PartyVisibility,
  PublicPartyListing,
} from '../types/party';
import { formatSol } from '../utils/format';
import {
  CREDITS_DISCLAIMER,
  fetchTowerEconomy,
  fetchTowerMe,
  loginTowerServer,
} from '../lib/towerApi';
import { simulatePrizePool } from '../../shared/tower/prize';

export function TowerLobbyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const pool = simulatePrizePool();
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [economy, setEconomy] = useState(pool);
  const [stakeSol, setStakeSol] = useState(loadLastStakeSol);
  const [publicParties, setPublicParties] = useState<PublicPartyListing[]>([]);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    void fetchTowerEconomy().then((e) => {
      if (e) setEconomy({ ...pool, ...e });
    });
    void fetchTowerMe().then((m) => {
      if (m) setBalance(m.balance);
    });
    return subscribePublicParties((list) => {
      setPublicParties(list.filter((party) => party.gameSlug === 'tower'));
    });
  }, []);

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

  const quickMatch = async () => {
    if (!user) {
      setError('Connect a wallet to play — including free games.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const session = await ensureServer();
      if (session) setBalance(session.balance);
      navigate('/game/tower/quick');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Server login failed');
    } finally {
      setBusy(false);
    }
  };

  const createTowerParty = (visibility: PartyVisibility) => {
    if (!user) return;
    const entryLamports = clampStakeLamports(solToLamports(stakeSol));
    saveLastStakeSol(stakeSol);
    const party = createParty({
      gameSlug: 'tower',
      capacity: 10 as PartyCapacity,
      visibility,
      entryLamports,
      host: {
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        color: user.color,
      },
    });
    navigate(
      `/party/${party.id}?game=tower&cap=10&host=${encodeURIComponent(party.hostId)}&vis=${visibility}&stake=${entryLamports}`,
    );
  };

  const joinTowerParty = (listing: PublicPartyListing) => {
    if (!user) {
      setError('Connect a wallet to join a SOL party.');
      return;
    }
    const stake = listing.entryLamports ?? solToLamports(stakeSol);
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
    navigate(`/party/${code}?game=tower&cap=10`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-cyan">CLASHR: TOWER</div>
      <h1 className="font-display text-4xl font-bold uppercase text-white">Climb. Shove. Survive.</h1>
      <p className="mt-2 text-sm text-white/55">
        10-player vertical PvP. First to the glowing WIN pad takes the simulated prize pool.
      </p>
      <p className="mt-3 text-[11px] uppercase tracking-widest text-neon-amber">{CREDITS_DISCLAIMER}</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Entry" value={`${economy.entry}`} />
        <Stat label="Prize pool" value={`${economy.prize}`} />
        <Stat label="Simulated fee" value={`${economy.platformFee}`} />
      </div>
      <p className="mt-2 text-xs text-white/40">
        10 × {economy.entry} = {economy.gross} demo credits. 5% simulated platform revenue. No real-money
        deposits, crypto, or withdrawals.
      </p>
      {balance != null && (
        <p className="mt-3 font-display text-sm text-neon-lime">Your demo balance: {balance}</p>
      )}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          onClick={() => navigate('/game/tower/practice?practice=1')}
        >
          Practice free vs bots
        </Button>
        <Button
          size="lg"
          variant="secondary"
          onClick={() => void quickMatch()}
          disabled={busy || !user}
        >
          {user ? 'Quick match · 10 players' : 'Connect wallet for quick match'}
        </Button>
      </div>
      <p className="mt-4 text-xs text-white/40">
        Practice vs bots is free, but you still need a connected wallet. Quick match uses the
        authoritative server, virtual credits, and bot backfill.
      </p>

      <section className="mt-10 border-t border-ink-700 pt-8">
        <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-lime">
          SOL parties
        </div>
        <h2 className="mt-1 font-display text-2xl font-bold uppercase text-white">
          Create or join a staked lobby
        </h2>
        <p className="mt-2 text-sm text-white/50">
          Public and private Tower parties use the same on-chain escrow as Bomb Party.
          Every connected wallet stakes before the host can start; bots never stake.
        </p>

        <div className="mt-5 rounded-2xl border border-neon-amber/25 bg-ink-850 p-5">
          <StakePicker
            valueSol={stakeSol}
            onChange={(value) => {
              setStakeSol(value);
              saveLastStakeSol(value);
            }}
            disabled={!user}
            hint="Stake paid by each real player when a second wallet joins."
          />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Button size="lg" disabled={!user} onClick={() => createTowerParty('public')}>
              <GlobeIcon className="h-5 w-5" /> Create public lobby
            </Button>
            <Button size="lg" variant="secondary" disabled={!user} onClick={() => createTowerParty('private')}>
              <LockIcon className="h-5 w-5" /> Create private lobby
            </Button>
          </div>
          <p className="mt-3 text-xs text-white/40">
            At 10 real players: {formatSol(computeEscrowPool(10, solToLamports(stakeSol)).prizePool)} winner pot
            after the 5% platform fee.
          </p>
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
            className="min-w-0 flex-1 rounded-xl border border-ink-600 bg-ink-850 px-4 py-3 font-display tracking-[0.18em] text-white outline-none placeholder:text-white/25 focus:border-neon-cyan"
          />
          <Button variant="secondary" disabled={!user} onClick={joinByCode}>
            Join party
          </Button>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-white">
            Public Tower lobbies
          </h3>
          <span className="text-xs text-white/35">{publicParties.length} waiting</span>
        </div>
        {publicParties.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-ink-600 bg-ink-900/40 px-5 py-8 text-center">
            <GlobeIcon className="mx-auto h-6 w-6 text-white/25" />
            <p className="mt-2 text-sm text-white/45">No public Tower lobbies yet.</p>
            <Button className="mt-4" variant="secondary" disabled={!user} onClick={() => createTowerParty('public')}>
              <PlusIcon className="h-4 w-4" /> Create the first
            </Button>
          </div>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {publicParties.map((listing) => {
              const stake = listing.entryLamports ?? solToLamports(stakeSol);
              const pot = computeEscrowPool(Math.max(2, listing.memberCount), stake);
              return (
                <div key={listing.id} className="rounded-2xl border border-neon-cyan/25 bg-ink-850 p-4">
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
                    {formatSol(stake / 1e9)} each · current pot {formatSol(pot.prizePool)}
                  </div>
                  <Button className="mt-4 w-full" disabled={!user} onClick={() => joinTowerParty(listing)}>
                    Join Tower lobby
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-600 bg-ink-850 p-4">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-1 font-display text-2xl font-bold text-neon-cyan">{value}</div>
    </div>
  );
}
