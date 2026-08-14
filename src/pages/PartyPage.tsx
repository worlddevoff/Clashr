import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  CopyIcon,
  CheckIcon,
  LinkIcon,
  PlayIcon,
  UsersIcon,
  CrownIcon,
  LogOutIcon,
  Share2Icon,
  AlertTriangleIcon,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import {
  mergeMember,
  openPartyChannel,
  partyInviteUrl,
  removeMember,
  savePartyRoster,
  listingFromParty,
  upsertPublicParty,
  removePublicParty,
  loadPartyLobby,
  savePartyLobby,
} from '../lib/party';
import {
  clampStakeLamports,
  computeEscrowPool,
  createAndJoinEscrow,
  joinEscrow,
  lamportsToSol,
  lockEscrow,
  parseStakeLamports,
  saveLastStakeSol,
  solToLamports,
  withdrawEscrow,
} from '../lib/escrow';
import type {
  Party,
  PartyGameRoster,
  PartyMember,
  PartyWireMessage,
  PartyVisibility,
} from '../types/party';
import { ENTRY_FEE, PARTY_CAPACITIES, clampEntry } from '../types/party';
import { cn } from '../utils/cn';
import { formatSol } from '../utils/format';
import { StakePicker } from '../components/game/StakePicker';

export function PartyPage() {
  const { partyId: rawId } = useParams();
  const [params] = useSearchParams();
  const partyId = (rawId ?? '').toUpperCase();
  const navigate = useNavigate();
  const { user, isAuthed } = useAuth();

  const capParam = Number(params.get('cap'));
  const savedLobby = loadPartyLobby(partyId);
  const gameSlug =
    params.get('game') === 'tower' || savedLobby?.gameSlug === 'tower'
      ? 'tower'
      : 'bomb-party';
  const gameName = gameSlug === 'tower' ? 'Tower' : 'Bomb Party';
  const capacity = PARTY_CAPACITIES.includes(capParam as (typeof PARTY_CAPACITIES)[number])
    ? (capParam as (typeof PARTY_CAPACITIES)[number])
    : PARTY_CAPACITIES.includes(savedLobby?.capacity as (typeof PARTY_CAPACITIES)[number])
      ? (savedLobby!.capacity as (typeof PARTY_CAPACITIES)[number])
      : 5;
  const hostFromUrl = params.get('host') || savedLobby?.hostId || '';
  const visParam = params.get('vis') ?? savedLobby?.visibility;
  const visibilityFromUrl: PartyVisibility = visParam === 'public' ? 'public' : 'private';
  const stakeFromUrl = parseStakeLamports(params.get('stake'), savedLobby?.entryLamports);
  const entryFromUrl = clampEntry(Number(params.get('entry')) || savedLobby?.entry || ENTRY_FEE);

  const [party, setParty] = useState<Party | null>(null);
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [staking, setStaking] = useState(false);

  const partyRef = useRef<Party | null>(null);
  const channelRef = useRef<ReturnType<typeof openPartyChannel> | null>(null);
  const escrowHostRef = useRef(false);
  const escrowJoinRef = useRef(false);
  const refundingRef = useRef(false);
  const selfId = user?.id ?? '';

  useEffect(() => {
    partyRef.current = party;
  }, [party]);

  const inviteUrl = party ? partyInviteUrl(party) : '';
  const deposits = party?.escrowDeposits ?? [];
  const stakeLamports = party?.entryLamports ?? stakeFromUrl;
  const stakeSol = lamportsToSol(stakeLamports);
  const pool = computeEscrowPool(deposits.length, stakeLamports);
  const seatsLeft = party ? Math.max(0, party.capacity - party.members.length) : 0;
  const isHost = !!party && party.hostId === selfId;
  const isPublic = party?.visibility === 'public';
  const selfStaked = !!selfId && deposits.includes(selfId);
  const realPot = !!party && party.members.length >= 2;
  const allStaked = !!party && party.members.every((m) => deposits.includes(m.id));
  const canStart = !realPot || (allStaked && !staking);

  // Keep public lobby listing in sync (host only)
  useEffect(() => {
    if (!party || !isHost) return;
    if (party.visibility !== 'public' || party.status !== 'waiting') {
      removePublicParty(party.id);
      return;
    }
    const listing = listingFromParty(party);
    if (listing) upsertPublicParty(listing);
    else removePublicParty(party.id);
  }, [party, isHost]);

  useEffect(() => {
    if (!party) return;
    savePartyLobby(party);
  }, [party]);

  const onWire = useCallback(
    (msg: PartyWireMessage) => {
      if (!selfId) return;

      if (msg.type === 'hello') {
        setParty((prev) => {
          if (!prev) return prev;
          const next = mergeMember(prev, msg.member);
          if (prev.hostId === selfId) {
            queueMicrotask(() => channelRef.current?.post({ type: 'sync', party: next }));
          }
          return next;
        });
        return;
      }

      if (msg.type === 'sync') {
        setParty((prev) => {
          if (prev?.status === 'live' && msg.party.status === 'waiting') return prev;
          let next = msg.party;
          if (!next.visibility) {
            next = { ...next, visibility: prev?.visibility ?? visibilityFromUrl };
          }
          if (!next.gameSlug) {
            next = { ...next, gameSlug };
          }
          if (user && !next.members.some((m) => m.id === user.id)) {
            next = mergeMember(next, {
              id: user.id,
              username: user.username,
              avatar: user.avatar,
              color: user.color,
              isHost: user.id === next.hostId,
              joinedAt: Date.now(),
            });
          }
          return next;
        });
        return;
      }

      if (msg.type === 'deposited') {
        setParty((prev) => {
          if (!prev) return prev;
          const deposits = [...new Set([...(prev.escrowDeposits ?? []), msg.memberId])];
          const next = { ...prev, escrowDeposits: deposits };
          if (prev.hostId === selfId) {
            queueMicrotask(() => channelRef.current?.post({ type: 'sync', party: next }));
          }
          return next;
        });
        return;
      }

      if (msg.type === 'unstaked') {
        setParty((prev) => {
          if (!prev) return prev;
          const next = {
            ...prev,
            escrowDeposits: (prev.escrowDeposits ?? []).filter((id) => id !== msg.memberId),
          };
          if (prev.hostId === selfId) {
            queueMicrotask(() => channelRef.current?.post({ type: 'sync', party: next }));
          }
          return next;
        });
        return;
      }

      if (msg.type === 'leave') {
        setParty((prev) => {
          if (!prev) return prev;
          const next = removeMember(prev, msg.memberId);
          return {
            ...next,
            escrowDeposits: (next.escrowDeposits ?? []).filter((id) =>
              next.members.some((m) => m.id === id),
            ),
          };
        });
        return;
      }

      if (msg.type === 'start') {
        removePublicParty(msg.party.id);
        setParty(msg.party);
        savePartyRoster(msg.roster);
        navigate(msg.gamePath);
        return;
      }

      if (
        msg.type === 'game:snapshot' ||
        msg.type === 'game:result' ||
        msg.type === 'game:key' ||
        msg.type === 'game:move' ||
        msg.type === 'game:taunt'
        || msg.type === 'tower:input'
        || msg.type === 'tower:snapshot'
        || msg.type === 'tower:result'
      ) {
        return;
      }

      if (msg.type === 'ping') {
        const current = partyRef.current;
        if (current && current.hostId === selfId) {
          channelRef.current?.post({ type: 'sync', party: current });
        }
      }
    },
    [selfId, user, navigate, visibilityFromUrl, gameSlug],
  );

  useEffect(() => {
    if (!isAuthed || !user || !partyId) return;

    const hostId = hostFromUrl || user.id;
    const self: PartyMember = {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      color: user.color,
      isHost: user.id === hostId,
      joinedAt: Date.now(),
    };

    const initial: Party = {
      id: partyId,
      gameSlug,
      capacity,
      entry: entryFromUrl,
      hostId,
      createdAt: Date.now(),
      status: 'waiting',
      visibility: visibilityFromUrl,
      members: [self],
      escrowDeposits: [],
      entryLamports: stakeFromUrl,
    };
    setParty(initial);

    const channel = openPartyChannel(partyId, onWire);
    channelRef.current = channel;

    const t = window.setTimeout(() => {
      channel.post({ type: 'hello', member: self });
      channel.post({ type: 'ping' });
      if (self.isHost) {
        channel.post({ type: 'sync', party: initial });
      }
    }, 40);

    return () => {
      window.clearTimeout(t);
      const current = partyRef.current;
      if (current?.status === 'waiting') {
        channel.post({ type: 'leave', memberId: user.id });
      }
      if (self.isHost) removePublicParty(partyId);
      channel.close();
      channelRef.current = null;
    };
  }, [partyId, isAuthed, user, capacity, hostFromUrl, visibilityFromUrl, stakeFromUrl, entryFromUrl, gameSlug, onWire]);

  useEffect(() => {
    if (!party || !user || !isHost || party.status !== 'waiting') return;
    if (party.members.length < 2) return;
    if ((party.escrowDeposits ?? []).includes(user.id) || escrowHostRef.current) return;
    escrowHostRef.current = true;
    setStaking(true);
    setError(null);
    void createAndJoinEscrow(party.id, party.capacity, party.entryLamports ?? stakeLamports)
      .then(({ pda }) => {
        setParty((prev) => {
          if (!prev) return prev;
          const next: Party = {
            ...prev,
            escrowPda: pda,
            escrowDeposits: [...new Set([...(prev.escrowDeposits ?? []), user.id])],
            entryLamports: prev.entryLamports ?? stakeLamports,
          };
          channelRef.current?.post({ type: 'sync', party: next });
          return next;
        });
      })
      .catch((e: unknown) => {
        escrowHostRef.current = false;
        setError(e instanceof Error ? e.message : 'Could not open the match escrow.');
      })
      .finally(() => setStaking(false));
  }, [party, user, isHost]);

  useEffect(() => {
    if (!party || !user || isHost || party.status !== 'waiting') return;
    if (party.members.length < 2 || !party.escrowPda) return;
    if ((party.escrowDeposits ?? []).includes(user.id) || escrowJoinRef.current) return;
    escrowJoinRef.current = true;
    setStaking(true);
    setError(null);
    void joinEscrow(party.id)
      .then(() => {
        channelRef.current?.post({ type: 'deposited', memberId: user.id });
        setParty((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            escrowDeposits: [...new Set([...(prev.escrowDeposits ?? []), user.id])],
          };
        });
      })
      .catch((e: unknown) => {
        escrowJoinRef.current = false;
        setError(e instanceof Error ? e.message : 'Could not stake SOL for this party.');
      })
      .finally(() => setStaking(false));
  }, [party, user, isHost]);

  useEffect(() => {
    if (!party || !user || party.status !== 'waiting') return;
    if (party.members.length >= 2) return;
    if (!selfStaked || refundingRef.current) {
      if (!selfStaked) {
        escrowHostRef.current = false;
        escrowJoinRef.current = false;
      }
      return;
    }
    refundingRef.current = true;
    void withdrawEscrow(party.id)
      .catch(() => undefined)
      .finally(() => {
        escrowHostRef.current = false;
        escrowJoinRef.current = false;
        refundingRef.current = false;
        setParty((prev) => {
          if (!prev) return prev;
          const next: Party = {
            ...prev,
            escrowDeposits: (prev.escrowDeposits ?? []).filter((id) => id !== user.id),
          };
          if (prev.hostId === user.id) {
            channelRef.current?.post({ type: 'sync', party: next });
          } else {
            channelRef.current?.post({ type: 'unstaked', memberId: user.id });
          }
          return next;
        });
      });
  }, [party, user, selfStaked]);

  const setMatchStake = (sol: number) => {
    if (!isHost || !party || party.status !== 'waiting') return;
    if (party.escrowPda || (party.escrowDeposits?.length ?? 0) > 0) return;
    const lamports = clampStakeLamports(solToLamports(sol));
    saveLastStakeSol(sol);
    setParty((prev) => {
      if (!prev) return prev;
      const next: Party = { ...prev, entryLamports: lamports };
      savePartyLobby(next);
      queueMicrotask(() => channelRef.current?.post({ type: 'sync', party: next }));
      return next;
    });
  };

  const copy = async (kind: 'link' | 'code') => {
    if (!party) return;
    const text = kind === 'link' ? inviteUrl : party.id;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setError('Could not copy — select the text manually.');
    }
  };

  const share = async () => {
    if (!party) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${gameName} invite`,
          text: `Join my ${party.visibility === 'public' ? 'public ' : ''}${gameName} party (${party.capacity}p) on Clashr — code ${party.id}`,
          url: inviteUrl,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    await copy('link');
  };

  const leave = () => {
    const current = partyRef.current;
    if (user) channelRef.current?.post({ type: 'leave', memberId: user.id });
    if (isHost && party) removePublicParty(party.id);
    if (current?.status === 'waiting' && selfStaked) {
      void withdrawEscrow(current.id).catch(() => undefined);
    }
    navigate(gameSlug === 'tower' ? '/play/tower' : '/play/bomb-party');
  };

  const start = async () => {
    if (!party || !isHost || starting) return;
    setError(null);
    const paidMatch = party.members.length >= 2;
    if (paidMatch && (!party.escrowPda || !allStaked)) {
      setError(`Every wallet in the lobby must stake ${formatSol(stakeSol)} before a real pot starts.`);
      return;
    }
    setStarting(true);
    if (paidMatch) {
      try {
        await lockEscrow(party.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not lock the match pot.');
        setStarting(false);
        return;
      }
    }
    removePublicParty(party.id);
    const query = `cap=${party.capacity}&entry=${party.entry}&party=${party.id}&stake=${stakeLamports}&host=${encodeURIComponent(party.hostId)}&vis=${party.visibility}`;
    const gamePath =
      gameSlug === 'tower'
        ? `/game/tower/${party.id.toLowerCase()}?${query}`
        : `/game/${party.id.toLowerCase()}?${query}`;
    const roster: PartyGameRoster = {
      partyId: party.id,
      gameSlug,
      hostId: party.hostId,
      capacity: party.capacity,
      entry: party.entry,
      members: party.members,
      escrowPda: paidMatch ? party.escrowPda : undefined,
      entryLamports: party.entryLamports,
    };
    savePartyRoster(roster);
    savePartyLobby(party);
    const next: Party = { ...party, status: 'live', gamePath };
    setParty(next);
    channelRef.current?.post({ type: 'start', party: next, gamePath, roster });
    navigate(gamePath);
  };

  if (!isAuthed || !user) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-display text-sm uppercase tracking-widest text-white/50">
          Connect your wallet to join this party
        </p>
        <Button onClick={() => navigate('/')}>Back to Clashr</Button>
      </div>
    );
  }

  if (!partyId) {
    navigate('/play');
    return null;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-magenta">
            {isPublic ? 'Public party' : 'Private party'}
          </div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-white">
            {gameName}
          </h1>
          <p className="mt-1 text-sm text-white/55">
            {isPublic
              ? 'Stays listed in the lobby until the lobby fills — or you start early with bots.'
              : 'Invite friends with the link or code. Empty seats fill with bots when you start.'}{' '}
            You all play the <span className="text-neon-cyan">same match</span>. SOL only
            stakes when <span className="text-white/80">2+ wallets</span> are in — bots are
            free.
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangleIcon className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
        className="overflow-hidden rounded-3xl border border-ink-600 bg-ink-850"
      >
        <div className="relative border-b border-ink-700 bg-ink-900 px-5 py-6">
          <div className="pointer-events-none absolute inset-0 bg-grid opacity-30" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="text-[10px] uppercase tracking-widest text-white/40">Party code</div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 font-display text-[9px] uppercase tracking-widest',
                    isPublic ? 'bg-neon-cyan/15 text-neon-cyan' : 'bg-white/10 text-white/50',
                  )}
                >
                  {isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="mt-1 font-display text-4xl font-bold tracking-[0.2em] text-neon-cyan text-glow-cyan">
                {party?.id ?? partyId}
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center gap-1.5 font-display text-xs uppercase tracking-wide text-white/60">
                <UsersIcon className="h-4 w-4" />
                {party?.members.length ?? 1}/{party?.capacity ?? '—'}
              </div>
              {realPot && pool.prizePool > 0 ? (
                <div className="mt-1 font-display text-sm text-neon-lime">
                  Pot {formatSol(pool.prizePool)} · {formatSol(stakeSol)} each
                </div>
              ) : (
                <div className="mt-1 font-display text-sm text-white/50">
                  {formatSol(stakeSol)} / wallet · free until a second player joins
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-2xl border border-neon-cyan/25 bg-ink-900/60 p-4">
            <div className="mb-2 font-display text-[11px] uppercase tracking-widest text-neon-cyan">
              {isPublic ? 'Share or find in lobby' : 'Invite friends'}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-ink-600 bg-ink-800 px-3 py-2.5">
                <LinkIcon className="h-4 w-4 shrink-0 text-white/40" />
                <span className="truncate font-mono text-xs text-white/70">{inviteUrl || '…'}</span>
              </div>
              <Button variant="secondary" onClick={() => copy('link')}>
                {copied === 'link' ? <CheckIcon className="h-4 w-4 text-neon-lime" /> : <CopyIcon className="h-4 w-4" />}
                {copied === 'link' ? 'Copied' : 'Copy link'}
              </Button>
              <Button variant="secondary" onClick={() => copy('code')}>
                {copied === 'code' ? <CheckIcon className="h-4 w-4 text-neon-lime" /> : <CopyIcon className="h-4 w-4" />}
                Code
              </Button>
              <Button onClick={share}>
                <Share2Icon className="h-4 w-4" /> Share
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-neon-amber/25 bg-ink-900/60 p-4">
            <StakePicker
              valueSol={stakeSol}
              onChange={setMatchStake}
              disabled={!isHost || !!party?.escrowPda || deposits.length > 0}
              hint={
                isHost
                  ? deposits.length > 0 || party?.escrowPda
                    ? 'Stake is locked for this match because wallets have already deposited.'
                    : 'This is the amount each wallet stakes for this match. Change it anytime before a second player joins.'
                  : `${formatSol(stakeSol)} per wallet for this match. Host sets the stake.`
              }
            />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-white">
                Players
              </h2>
              <span className="text-[11px] uppercase tracking-widest text-white/35">
                {seatsLeft} open seat{seatsLeft === 1 ? '' : 's'}
              </span>
            </div>
            <ul className="space-y-2">
              {(party?.members ?? []).map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                    m.id === selfId ? 'border-neon-cyan/40 bg-ink-800' : 'border-ink-600 bg-ink-900/50',
                  )}
                >
                  <span
                    className="grid h-10 w-10 place-items-center rounded-xl text-xl"
                    style={{ border: `2px solid ${m.color}`, boxShadow: `0 0 12px ${m.color}44` }}
                  >
                    {m.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-sm font-semibold text-white">
                      {m.username}
                      {m.id === selfId ? ' (you)' : ''}
                    </div>
                    {m.isHost && (
                      <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-neon-amber">
                        <CrownIcon className="h-3 w-3" /> Host
                      </div>
                    )}
                  </div>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-display text-[9px] uppercase tracking-widest',
                      !realPot
                        ? 'bg-white/10 text-white/45'
                        : deposits.includes(m.id)
                          ? 'bg-neon-lime/15 text-neon-lime'
                          : staking && m.id === selfId
                            ? 'bg-white/10 text-white/50'
                            : 'bg-white/5 text-white/35',
                    )}
                  >
                    {!realPot
                      ? 'Practice'
                      : deposits.includes(m.id)
                        ? 'Staked'
                        : staking && m.id === selfId
                          ? 'Staking…'
                          : 'Awaiting SOL'}
                  </span>
                </li>
              ))}
              {Array.from({ length: seatsLeft }).map((_, i) => (
                <li
                  key={`empty-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-dashed border-ink-600 px-3 py-2.5 text-white/30"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-dashed border-ink-600 text-sm">
                    ?
                  </span>
                  <span className="font-display text-xs uppercase tracking-wide">
                    {isPublic ? 'Open · waiting in lobby' : 'Waiting for invite…'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {isPublic && isHost && seatsLeft > 0 && (
            <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-3 text-sm text-neon-cyan/90">
              Waiting for players in the public lobby. Start with bots for free, or wait for a
              second wallet to open a SOL pot.
            </div>
          )}
          {isPublic && isHost && seatsLeft === 0 && (
            <div className="rounded-xl border border-neon-lime/30 bg-neon-lime/5 px-4 py-3 text-sm text-neon-lime/90">
              Lobby full — start the match when you&apos;re ready.
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            {isHost ? (
              isPublic && seatsLeft > 0 ? (
                <>
                  <div className="flex flex-1 flex-col justify-center rounded-xl border border-ink-600 bg-ink-900 px-4 py-3">
                    <div className="font-display text-xs uppercase tracking-widest text-white/50">
                      Sitting in lobby
                    </div>
                    <div className="mt-0.5 text-sm text-white/40">
                      {party?.members.length}/{party?.capacity} filled · open for joiners
                    </div>
                  </div>
                  <Button
                    size="lg"
                    variant="secondary"
                    className="sm:min-w-[12rem]"
                    disabled={starting || !canStart}
                    onClick={() => void start()}
                  >
                    <PlayIcon className="h-5 w-5" />
                    {starting ? 'Starting…' : 'Start with bots'}
                  </Button>
                </>
              ) : (
                <Button size="lg" className="flex-1" disabled={starting || !canStart} onClick={() => void start()}>
                  <PlayIcon className="h-5 w-5" />
                  {starting
                    ? 'Starting…'
                    : seatsLeft > 0
                      ? 'Start · fill with bots'
                      : isPublic
                        ? 'Start match'
                        : 'Start party'}
                </Button>
              )
            ) : (
              <div className="flex-1 rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-center font-display text-xs uppercase tracking-widest text-white/45">
                {isPublic && seatsLeft > 0
                  ? 'Waiting in lobby for more players…'
                  : 'Waiting for host to start…'}
              </div>
            )}
            <Button size="lg" variant="secondary" onClick={leave}>
              <LogOutIcon className="h-5 w-5" /> Leave
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
