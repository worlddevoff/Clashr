import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
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
  WalletIcon,
  LoaderCircleIcon,
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
  fetchParty,
  joinPartyState,
  leavePartyState,
  publishPartyState,
  reportPartyDeposit,
  startPartyState,
  touchPartyState,
} from '../lib/partyRemote';
import {
  computeEscrowPool,
  createAndJoinEscrow,
  joinEscrow,
  lamportsToSol,
  lockEscrow,
  parseStakeLamports,
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
import { useSolPots } from '../contexts/SolPotsContext';

export function PartyPage() {
  const { partyId: rawId } = useParams();
  const [params] = useSearchParams();
  const partyId = (rawId ?? '').toUpperCase();
  const navigate = useNavigate();
  const { onAuth } = useOutletContext<{ onAuth?: () => void }>() ?? { onAuth: undefined };
  const { user, isAuthed, connecting, connectWallet } = useAuth();
  const potsOn = useSolPots();

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
  const [stakeFailed, setStakeFailed] = useState(false);
  const [startFailed, setStartFailed] = useState(false);

  const partyRef = useRef<Party | null>(null);
  const channelRef = useRef<ReturnType<typeof openPartyChannel> | null>(null);
  const onWireRef = useRef<(msg: PartyWireMessage) => void>(() => undefined);
  const startRef = useRef<() => Promise<void>>(async () => undefined);
  const selfId = user?.id ?? '';

  useEffect(() => {
    if (isAuthed || !partyId) return;
    void fetchParty(partyId).then((remote) => {
      if (remote) setParty(remote);
    });
  }, [isAuthed, partyId]);

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
  const seated = !!user && !!party && party.members.some((m) => m.id === user.id);
  const realPot = potsOn && !!party && party.members.length >= 2;
  const allStaked = !!party && party.members.every((m) => deposits.includes(m.id));
  const lobbyFull = !!party && seatsLeft === 0;
  const canStart = !potsOn || !realPot || (allStaked && !staking);
  // Paid pots need a host click so Phantom can lock the escrow (no wallet popup from useEffect).
  const readyToAutoStart =
    !!party &&
    party.status === 'waiting' &&
    lobbyFull &&
    canStart &&
    !starting &&
    !startFailed &&
    !realPot;

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
    void publishPartyState(party);
  }, [party, isHost]);

  useEffect(() => {
    if (!party || !isHost || party.status !== 'waiting') return;
    void touchPartyState(party.id, party.hostId);
    const tick = window.setInterval(() => {
      void touchPartyState(party.id, party.hostId);
    }, 20000);
    return () => window.clearInterval(tick);
  }, [party?.id, party?.hostId, party?.status, isHost]);

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
  onWireRef.current = onWire;

  useEffect(() => {
    if (!isAuthed || !user || !partyId) return;
    let cancelled = false;
    const userId = user.id;

    const selfFromUser = (): PartyMember => ({
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      color: user.color,
      isHost: false,
      joinedAt: Date.now(),
    });

    const bootstrap = async () => {
      const self = selfFromUser();
      const weAreProbablyHost = !!hostFromUrl && userId === hostFromUrl;
      self.isHost = weAreProbablyHost;

      if (weAreProbablyHost) {
        const optimistic: Party = {
          id: partyId,
          gameSlug,
          capacity,
          entry: entryFromUrl,
          hostId: hostFromUrl || userId,
          createdAt: Date.now(),
          status: 'waiting',
          visibility: visibilityFromUrl,
          members: [self],
          escrowDeposits: [],
          entryLamports: stakeFromUrl,
        };
        setParty(optimistic);
        void publishPartyState(optimistic);
      }

      const remote = await fetchParty(partyId);
      if (cancelled) return;

      const hostId = remote?.hostId || hostFromUrl;
      const weAreHost = !!hostId && userId === hostId;
      self.isHost = weAreHost;

      if (!remote && !weAreHost) {
        setError('Party not found. Open the host’s join link, or paste the code on Play and tap Join party.');
        return;
      }

      let initial: Party =
        remote ??
        {
          id: partyId,
          gameSlug,
          capacity,
          entry: entryFromUrl,
          hostId: hostId || userId,
          createdAt: Date.now(),
          status: 'waiting',
          visibility: visibilityFromUrl,
          members: [],
          escrowDeposits: [],
          entryLamports: stakeFromUrl,
        };
      initial = mergeMember(initial, self);

      if (weAreHost) {
        void publishPartyState(initial);
      } else {
        const joined = await joinPartyState(partyId, self);
        if (cancelled) return;
        if (joined.error) {
          setError(joined.error.replace(/^.*: /, ''));
        }
        if (joined.party) {
          initial = mergeMember(joined.party, self);
        } else {
          const latest = await fetchParty(partyId);
          if (latest) initial = mergeMember(latest, self);
        }
      }
      if (cancelled) return;

      if (initial.status === 'live' && initial.gamePath) {
        savePartyRoster({
          partyId: initial.id,
          gameSlug: initial.gameSlug,
          hostId: initial.hostId,
          capacity: initial.capacity,
          entry: initial.entry,
          members: initial.members,
          escrowPda: initial.escrowPda,
          entryLamports: initial.entryLamports,
        });
        navigate(initial.gamePath);
        return;
      }

      setParty(initial);
      const channel = openPartyChannel(partyId, (msg) => onWireRef.current(msg));
      channelRef.current = channel;
      void channel.ready.then(() => {
        if (cancelled) {
          channel.close();
          return;
        }
        channel.post({ type: 'hello', member: self });
        channel.post({ type: 'ping' });
        if (self.isHost) channel.post({ type: 'sync', party: initial });
      });
    };

    void bootstrap();
    return () => {
      cancelled = true;
      channelRef.current?.close();
      channelRef.current = null;
    };
  }, [partyId, isAuthed, user?.id, capacity, hostFromUrl, visibilityFromUrl, stakeFromUrl, entryFromUrl, gameSlug, navigate]);

  useEffect(() => {
    if (!isAuthed || !user || !partyId) return;
    const userId = user.id;
    return () => {
      const current = partyRef.current;
      if (current?.status === 'waiting' && current.hostId !== userId) {
        void leavePartyState(partyId, userId);
      }
    };
  }, [partyId, isAuthed, user?.id]);

  useEffect(() => {
    if (!partyId || party?.status === 'live') return;
    const poll = window.setInterval(() => {
      void fetchParty(partyId).then((remote) => {
        if (!remote) return;
        if (remote.status === 'live' && remote.gamePath) {
          savePartyRoster({
            partyId: remote.id,
            gameSlug: remote.gameSlug,
            hostId: remote.hostId,
            capacity: remote.capacity,
            entry: remote.entry,
            members: remote.members,
            escrowPda: remote.escrowPda,
            entryLamports: remote.entryLamports,
          });
          navigate(remote.gamePath);
          return;
        }
        setParty((prev) => {
          if (prev?.status === 'live') return prev;
          if (!prev) return remote;
          return {
            ...remote,
            escrowDeposits: remote.escrowDeposits?.length ? remote.escrowDeposits : prev.escrowDeposits,
            escrowPda: remote.escrowPda ?? prev.escrowPda,
            entryLamports: remote.entryLamports ?? prev.entryLamports,
          };
        });
      });
    }, 1200);
    return () => window.clearInterval(poll);
  }, [partyId, party?.status, navigate]);

  const stakeSelf = useCallback(async () => {
    if (!party || !user) {
      setError('Connect a wallet to stake.');
      return;
    }
    if (!potsOn) {
      setError('SOL pots are not live on the match server yet.');
      return;
    }
    if (party.status !== 'waiting') {
      setError('This lobby already started.');
      return;
    }
    if ((party.escrowDeposits ?? []).includes(user.id)) return;
    const weAreHost = party.hostId === user.id;
    if (!weAreHost && !party.escrowPda) {
      setError('Waiting for the host to open the pot.');
      return;
    }
    setStaking(true);
    setStakeFailed(false);
    setError(null);
    const timeout = window.setTimeout(() => {
      setStaking(false);
      setStakeFailed(true);
      setError('Wallet did not finish. Close Phantom and tap Retry stake.');
    }, 90_000);
    try {
      if (weAreHost) {
        const { pda } = await createAndJoinEscrow(
          party.id,
          party.capacity,
          party.entryLamports ?? stakeLamports,
        );
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
        void reportPartyDeposit(party.id);
        setError(null);
      } else {
        await joinEscrow(party.id);
        channelRef.current?.post({ type: 'deposited', memberId: user.id });
        setParty((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            escrowDeposits: [...new Set([...(prev.escrowDeposits ?? []), user.id])],
          };
        });
        void reportPartyDeposit(party.id);
        setError(null);
      }
    } catch (e: unknown) {
      setStakeFailed(true);
      setError(e instanceof Error ? e.message : 'Could not stake SOL for this party.');
    } finally {
      window.clearTimeout(timeout);
      setStaking(false);
    }
  }, [party, user, potsOn, stakeLamports]);

  const setMatchStake = (_sol: number) => {
    /* Stake is fixed when the lobby is created. */
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
    if (user) {
      channelRef.current?.post({ type: 'leave', memberId: user.id });
      void leavePartyState(partyId, user.id);
      sessionStorage.removeItem(`clashr:autostake:${partyId}:${user.id}`);
    }
    if (isHost && party) {
      removePublicParty(party.id);
      sessionStorage.removeItem(`clashr:autostart:${party.id}`);
    }
    if (current?.status === 'waiting' && selfStaked) {
      void withdrawEscrow(current.id).catch(() => undefined);
    }
    navigate(gameSlug === 'tower' ? '/play/tower' : '/play/bomb-party');
  };

  const start = async () => {
    if (!party || !isHost || starting) return;
    setError(null);
    const paidMatch = potsOn && party.members.length >= 2;
    if (paidMatch && (!party.escrowPda || !allStaked)) {
      setError(`Every wallet in the lobby must stake ${formatSol(stakeSol)} before a real pot starts.`);
      return;
    }
    setStarting(true);
    setStartFailed(false);
    if (paidMatch) {
      try {
        await lockEscrow(party.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not lock the match pot.');
        setStarting(false);
        setStartFailed(true);
        sessionStorage.removeItem(`clashr:autostart:${party.id}`);
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
    void startPartyState(party.id, party.hostId, gamePath);
    channelRef.current?.post({ type: 'start', party: next, gamePath, roster });
    navigate(gamePath);
  };
  startRef.current = start;

  useEffect(() => {
    if (!isHost || !readyToAutoStart || !party) return;
    const key = `clashr:autostart:${party.id}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void startRef.current();
  }, [isHost, readyToAutoStart, party?.id]);

  if (!isAuthed || !user) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-magenta">
          {gameName} party
        </div>
        <div className="font-display text-4xl font-bold tracking-[0.2em] text-neon-cyan text-glow-cyan">
          {partyId || '——'}
        </div>
        <p className="text-sm text-white/55">
          Connect the wallet you want to play with. Joining this lobby stakes {formatSol(stakeSol)}{' '}
          automatically, then the match starts when every seat is filled.
        </p>
        {party && party.members.length > 0 && (
          <ul className="w-full space-y-2 text-left">
            {party.members.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-ink-600 bg-ink-900/50 px-3 py-2.5"
              >
                <span className="grid h-10 w-10 place-items-center rounded-xl text-xl">{m.avatar}</span>
                <span className="font-display text-sm font-semibold text-white">{m.username}</span>
              </li>
            ))}
          </ul>
        )}
        <Button
          size="lg"
          disabled={connecting}
          onClick={() => {
            void connectWallet().then((res) => {
              if (!res.ok || res.isNew) onAuth?.();
            });
          }}
        >
          {connecting ? (
            <LoaderCircleIcon className="h-5 w-5 animate-spin" />
          ) : (
            <WalletIcon className="h-5 w-5" />
          )}
          {connecting ? 'Connecting…' : 'Join party'}
        </Button>
      </div>
    );
  }

  if (!partyId) {
    navigate('/play');
    return null;
  }

  if (!party) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 py-16 text-center">
        <div className="font-display text-4xl font-bold tracking-[0.2em] text-neon-cyan text-glow-cyan">
          {partyId}
        </div>
        <p className="text-sm text-white/55">
          {error ?? 'Joining this lobby…'}
        </p>
        <Button
          size="lg"
          disabled={connecting}
          onClick={() => {
            if (!user) {
              void connectWallet().then((res) => {
                if (!res.ok || res.isNew) onAuth?.();
              });
              return;
            }
            setError(null);
            void joinPartyState(partyId, {
              id: user.id,
              username: user.username,
              avatar: user.avatar,
              color: user.color,
              isHost: false,
              joinedAt: Date.now(),
            }).then(async (joined) => {
              if (joined.error) setError(joined.error.replace(/^.*: /, ''));
              const next = joined.party ?? (await fetchParty(partyId));
              if (next) setParty(mergeMember(next, {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                color: user.color,
                isHost: user.id === next.hostId,
                joinedAt: Date.now(),
              }));
            });
          }}
        >
          <WalletIcon className="h-5 w-5" />
          Join party
        </Button>
      </div>
    );
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
              ? 'Listed until the lobby fills. Approve stake in Phantom when you sit. Host starts when every seat is staked.'
              : 'Invite friends with the link or code. Approve stake in Phantom when you sit. Host starts when every seat is filled and staked.'}{' '}
            You all play the <span className="text-neon-cyan">same match</span>.
            {potsOn
              ? ` ${formatSol(stakeSol)} SOL each. Empty seats can still be filled with bots if you start early.`
              : ' Real SOL pots are off until house settlement is live.'}
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
              {potsOn && realPot && pool.prizePool > 0 ? (
                <div className="mt-1 font-display text-sm text-neon-lime">
                  Pot {formatSol(pool.prizePool)} · {formatSol(stakeSol)} each
                </div>
              ) : potsOn ? (
                <div className="mt-1 font-display text-sm text-white/50">
                  {formatSol(stakeSol)} / wallet · match starts when full
                </div>
              ) : (
                <div className="mt-1 font-display text-sm text-white/50">Demo credits match</div>
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

          {potsOn && (
          <div className="rounded-2xl border border-neon-amber/25 bg-ink-900/60 p-4">
            <StakePicker
              valueSol={stakeSol}
              onChange={setMatchStake}
              disabled
              hint={`${formatSol(stakeSol)} per wallet. Tap Approve stake in Phantom to sit. Host starts when the lobby is full.`}
            />
          </div>
          )}

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
                      !potsOn
                        ? 'bg-white/10 text-white/45'
                        : deposits.includes(m.id)
                          ? 'bg-neon-lime/15 text-neon-lime'
                          : staking && m.id === selfId
                            ? 'bg-white/10 text-white/50'
                            : 'bg-white/5 text-white/35',
                    )}
                  >
                    {!potsOn
                      ? 'Ready'
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
                  <span className="min-w-0 flex-1 font-display text-xs uppercase tracking-wide">
                    {isPublic ? 'Open · waiting in lobby' : 'Waiting for invite…'}
                  </span>
                  {isHost && i === 0 && (
                    <Button size="sm" variant="secondary" onClick={() => copy('link')}>
                      Copy join link
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {isPublic && isHost && seatsLeft > 0 && (
            <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 px-4 py-3 text-sm text-neon-cyan/90">
              Waiting for players to join and stake. Tap Start when every wallet has staked — or start early with bots.
            </div>
          )}
          {lobbyFull && (
            <div className="rounded-xl border border-neon-lime/30 bg-neon-lime/5 px-4 py-3 text-sm text-neon-lime/90">
              {potsOn && !allStaked
                ? 'Lobby full — starting as soon as every wallet has staked.'
                : starting || readyToAutoStart
                  ? 'Lobby full and staked — starting the match.'
                  : 'Lobby full and staked.'}
            </div>
          )}

          {potsOn && seated && !selfStaked && (
            <Button
              size="lg"
              className="w-full"
              disabled={staking || (!isHost && !party.escrowPda)}
              onClick={() => void stakeSelf()}
            >
              <WalletIcon className="h-5 w-5" />
              {staking
                ? 'Approve stake in Phantom…'
                : !isHost && !party.escrowPda
                  ? 'Waiting for host to open the pot…'
                  : stakeFailed
                    ? 'Retry stake'
                    : 'Approve stake in Phantom'}
            </Button>
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
                      {party?.members.length}/{party?.capacity} filled · starts when full
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
                <Button
                  size="lg"
                  className="flex-1"
                  disabled={starting || !canStart}
                  onClick={() => void start()}
                >
                  <PlayIcon className="h-5 w-5" />
                  {starting
                    ? 'Starting…'
                    : seatsLeft > 0
                      ? 'Start · fill with bots'
                      : startFailed
                        ? 'Start match'
                        : potsOn && !allStaked
                          ? 'Waiting for stakes…'
                          : 'Starting match…'}
                </Button>
              )
            ) : party.members.some((m) => m.id === selfId) ? (
              <div className="flex-1 rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-center font-display text-xs uppercase tracking-widest text-white/45">
                {seatsLeft > 0
                  ? 'Waiting for the lobby to fill — match starts automatically.'
                  : potsOn && !allStaked
                    ? 'Lobby full — waiting for every wallet to stake.'
                    : 'Lobby full — match starting.'}
              </div>
            ) : (
              <Button
                size="lg"
                className="flex-1"
                disabled={connecting}
                onClick={() => {
                  if (!user) return;
                  setError(null);
                  void joinPartyState(partyId, {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar,
                    color: user.color,
                    isHost: false,
                    joinedAt: Date.now(),
                  }).then(async (joined) => {
                    if (joined.error) setError(joined.error.replace(/^.*: /, ''));
                    const next = joined.party ?? (await fetchParty(partyId));
                    if (next) {
                      setParty(mergeMember(next, {
                        id: user.id,
                        username: user.username,
                        avatar: user.avatar,
                        color: user.color,
                        isHost: user.id === next.hostId,
                        joinedAt: Date.now(),
                      }));
                    }
                  });
                }}
              >
                <WalletIcon className="h-5 w-5" />
                Join party
              </Button>
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
