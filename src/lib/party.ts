import type {
  Party,
  PartyMember,
  PartyWireMessage,
  PartyCapacity,
  PartyGameRoster,
  PartyVisibility,
  PublicPartyListing,
} from '../types/party';
import { ENTRY_FEE } from '../types/party';
import type { GameSlug } from '../../shared/games';
import { fetchPublicParties } from './partyRemote';
import { getSupabase } from './supabase';
import { siteOrigin } from '../../shared/site';

const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROSTER_PREFIX = 'arcade.party.roster.';
const PUBLIC_LIST_KEY = 'arcade.public.parties.v1';
const PUBLIC_CHANNEL = 'arcade-public-parties';

export function createPartyId(): string {
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

export function partyChannelName(partyId: string): string {
  return `arcade-party-${partyId.toUpperCase()}`;
}

export function createParty(opts: {
  capacity: PartyCapacity;
  gameSlug?: GameSlug;
  visibility?: PartyVisibility;
  entry?: number;
  entryLamports?: number;
  host: Omit<PartyMember, 'isHost' | 'joinedAt'>;
}): Party {
  const id = createPartyId();
  const host: PartyMember = {
    ...opts.host,
    isHost: true,
    joinedAt: Date.now(),
  };
  return {
    id,
    gameSlug: opts.gameSlug ?? 'bomb-party',
    capacity: opts.capacity,
    entry: opts.entry ?? ENTRY_FEE,
    hostId: host.id,
    createdAt: Date.now(),
    status: 'waiting',
    visibility: opts.visibility ?? 'private',
    members: [host],
    escrowDeposits: [],
    entryLamports: opts.entryLamports,
  };
}

export function partyInviteUrl(
  party: Pick<Party, 'id' | 'gameSlug' | 'capacity' | 'hostId' | 'visibility' | 'entry' | 'entryLamports'>,
  origin = siteOrigin(),
): string {
  const params = new URLSearchParams({
    cap: String(party.capacity),
    host: party.hostId,
    vis: party.visibility ?? 'private',
    entry: String(party.entry),
    game: party.gameSlug,
  });
  if (party.entryLamports) params.set('stake', String(party.entryLamports));
  return `${origin}/party/${party.id.toUpperCase()}?${params.toString()}`;
}

export function parsePartyCode(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length < 4) return null;
  return cleaned.slice(0, 8);
}

const LOBBY_PREFIX = 'arcade.party.lobby.';

export function savePartyLobby(
  party: Pick<Party, 'id' | 'gameSlug' | 'capacity' | 'hostId' | 'visibility' | 'entry' | 'entryLamports'>,
): void {
  try {
    sessionStorage.setItem(
      LOBBY_PREFIX + party.id.toUpperCase(),
      JSON.stringify({
        id: party.id.toUpperCase(),
        gameSlug: party.gameSlug,
        capacity: party.capacity,
        hostId: party.hostId,
        visibility: party.visibility,
        entry: party.entry,
        entryLamports: party.entryLamports,
      }),
    );
  } catch {
    /* ignore */
  }
}

export function loadPartyLobby(partyId: string): {
  id: string;
  gameSlug?: GameSlug;
  capacity: number;
  hostId: string;
  visibility: PartyVisibility;
  entry?: number;
  entryLamports?: number;
} | null {
  try {
    const raw = sessionStorage.getItem(LOBBY_PREFIX + partyId.toUpperCase());
    if (!raw) return null;
    return JSON.parse(raw) as {
      id: string;
      gameSlug?: GameSlug;
      capacity: number;
      hostId: string;
      visibility: PartyVisibility;
      entry?: number;
      entryLamports?: number;
    };
  } catch {
    return null;
  }
}

export function savePartyRoster(roster: PartyGameRoster): void {
  try {
    sessionStorage.setItem(ROSTER_PREFIX + roster.partyId.toUpperCase(), JSON.stringify(roster));
  } catch {
    /* ignore */
  }
}

export function loadPartyRoster(partyId: string): PartyGameRoster | null {
  try {
    const raw = sessionStorage.getItem(ROSTER_PREFIX + partyId.toUpperCase());
    if (!raw) return null;
    return JSON.parse(raw) as PartyGameRoster;
  } catch {
    return null;
  }
}

export function mergeMember(party: Party, member: PartyMember): Party {
  const already = party.members.some((m) => m.id === member.id);
  if (!already && party.members.length >= party.capacity) return party;
  const without = party.members.filter((m) => m.id !== member.id);
  const members = [...without, member].sort((a, b) => a.joinedAt - b.joinedAt);
  return {
    ...party,
    members: members.map((m) => ({ ...m, isHost: m.id === party.hostId })),
  };
}

export function removeMember(party: Party, memberId: string): Party {
  return {
    ...party,
    members: party.members.filter((m) => m.id !== memberId),
  };
}

function readPublicList(): PublicPartyListing[] {
  try {
    const raw = localStorage.getItem(PUBLIC_LIST_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PublicPartyListing[];
    if (!Array.isArray(list)) return [];
    // Drop stale listings (> 45 min)
    const cutoff = Date.now() - 45 * 60 * 1000;
    return list.filter((p) => p.createdAt > cutoff && p.memberCount > 0);
  } catch {
    return [];
  }
}

function writePublicList(list: PublicPartyListing[]): void {
  try {
    localStorage.setItem(PUBLIC_LIST_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  try {
    const ch = new BroadcastChannel(PUBLIC_CHANNEL);
    ch.postMessage({ type: 'refresh' });
    ch.close();
  } catch {
    /* ignore */
  }
}

export function listingFromParty(party: Party): PublicPartyListing | null {
  if (party.visibility !== 'public' || party.status !== 'waiting') return null;
  const host = party.members.find((m) => m.id === party.hostId);
  if (!host || party.members.length === 0) return null;
  if (party.members.length >= party.capacity) return null;
  return {
    id: party.id.toUpperCase(),
    gameSlug: party.gameSlug,
    capacity: party.capacity,
    entry: party.entry,
    entryLamports: party.entryLamports,
    hostId: party.hostId,
    hostName: host.username,
    memberCount: party.members.length,
    createdAt: party.createdAt,
  };
}

export function upsertPublicParty(listing: PublicPartyListing): void {
  const id = listing.id.toUpperCase();
  const next = readPublicList().filter((p) => p.id !== id);
  next.unshift({ ...listing, id });
  writePublicList(next);
}

export function removePublicParty(partyId: string): void {
  const id = partyId.toUpperCase();
  writePublicList(readPublicList().filter((p) => p.id !== id));
}

export function listPublicParties(): PublicPartyListing[] {
  return readPublicList().sort((a, b) => b.createdAt - a.createdAt);
}

/** Live updates for the Play lobby public list. */
export function subscribePublicParties(onChange: (list: PublicPartyListing[]) => void): () => void {
  let stopped = false;
  const emitLocal = () => onChange(listPublicParties());

  const pull = () => {
    void fetchPublicParties().then((remote) => {
      if (stopped) return;
      if (remote) onChange(remote);
      else emitLocal();
    });
  };

  pull();
  const onStorage = (e: StorageEvent) => {
    if (e.key === PUBLIC_LIST_KEY) emitLocal();
  };
  window.addEventListener('storage', onStorage);
  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(PUBLIC_CHANNEL);
    channel.onmessage = () => emitLocal();
  } catch {
    /* ignore */
  }

  const poll = window.setInterval(pull, 2000);
  return () => {
    stopped = true;
    window.removeEventListener('storage', onStorage);
    channel?.close();
    window.clearInterval(poll);
  };
}

/** Cross-machine lobby sync (Supabase Realtime) with a same-tab BroadcastChannel fallback. */
export function openPartyChannel(
  partyId: string,
  onMessage: (msg: PartyWireMessage) => void,
): { post: (msg: PartyWireMessage) => void; close: () => void; ready: Promise<void> } {
  const name = partyChannelName(partyId);
  let local: BroadcastChannel | null = null;
  try {
    local = new BroadcastChannel(name);
    local.onmessage = (ev: MessageEvent<PartyWireMessage>) => {
      if (ev.data?.type) onMessage(ev.data);
    };
  } catch {
    /* BroadcastChannel unsupported */
  }

  let settled = false;
  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((resolve) => {
    resolveReady = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
  });

  const sb = getSupabase();
  const room = `clashr-party-${partyId.toUpperCase()}`;
  const rt = sb
    ? sb
        .channel(room)
        .on('broadcast', { event: 'wire' }, ({ payload }) => {
          const msg = payload as PartyWireMessage;
          if (msg?.type) onMessage(msg);
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') resolveReady();
        })
    : null;
  if (!rt) resolveReady();
  window.setTimeout(resolveReady, 2500);

  return {
    ready,
    post(msg) {
      local?.postMessage(msg);
      void rt?.send({ type: 'broadcast', event: 'wire', payload: msg });
    },
    close() {
      local?.close();
      local = null;
      if (rt && sb) void sb.removeChannel(rt);
    },
  };
}
