import { apiJson, apiUrl } from './api';
import { getSessionToken } from './session';
import type { Party, PartyMember, PublicPartyListing } from '../types/party';
import { isGameSlug, type GameSlug } from '../../shared/games';

interface ListingRow {
  id?: unknown;
  game_slug?: unknown;
  gameSlug?: unknown;
  capacity?: unknown;
  entry?: unknown;
  entry_lamports?: unknown;
  entryLamports?: unknown;
  host_id?: unknown;
  hostId?: unknown;
  host_name?: unknown;
  hostName?: unknown;
  member_count?: unknown;
  memberCount?: unknown;
  created_at?: unknown;
  createdAt?: unknown;
}

interface RemoteMember {
  id?: unknown;
  username?: unknown;
  avatar?: unknown;
  color?: unknown;
  isHost?: unknown;
  joinedAt?: unknown;
}

interface RemotePartyRow {
  id?: unknown;
  game_slug?: unknown;
  capacity?: unknown;
  entry?: unknown;
  entry_lamports?: unknown;
  host_id?: unknown;
  status?: unknown;
  visibility?: unknown;
  escrow_pda?: unknown;
  escrow_deposits?: unknown;
  game_path?: unknown;
  created_at?: unknown;
  members?: unknown;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asGameSlug(value: unknown): GameSlug {
  const slug = asString(value, 'bomb-party');
  return isGameSlug(slug) ? slug : 'bomb-party';
}

export function mapPublicListings(raw: unknown): PublicPartyListing[] {
  const rows = Array.isArray(raw) ? (raw as ListingRow[]) : [];
  const list: PublicPartyListing[] = [];
  for (const row of rows) {
    const id = asString(row.id).toUpperCase();
    const hostId = asString(row.hostId ?? row.host_id);
    const memberCount = asNumber(row.memberCount ?? row.member_count);
    const capacity = asNumber(row.capacity, 5);
    if (!id || !hostId || memberCount < 1 || capacity < 2) continue;
    list.push({
      id,
      gameSlug: asGameSlug(row.gameSlug ?? row.game_slug),
      capacity,
      entry: asNumber(row.entry),
      entryLamports: asNumber(row.entryLamports ?? row.entry_lamports) || undefined,
      hostId,
      hostName: asString(row.hostName ?? row.host_name, 'Host'),
      memberCount,
      createdAt: asNumber(row.createdAt ?? row.created_at, Date.now()),
    });
  }
  return list;
}

function mapMember(row: RemoteMember, hostId: string): PartyMember | null {
  const id = asString(row.id ?? (row as { userId?: unknown }).userId);
  if (!id) return null;
  return {
    id,
    username: asString(row.username, 'Player'),
    avatar: asString(row.avatar, '🗼'),
    color: asString(row.color, '#22e5ff'),
    isHost: row.isHost === true || id === hostId,
    joinedAt: asNumber(row.joinedAt, Date.now()),
  };
}

export function mapRemoteParty(raw: unknown): Party | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as RemotePartyRow & Party;
  if (typeof row.gameSlug === 'string' && Array.isArray(row.members) && row.hostId) {
    return { ...row, id: asString(row.id).toUpperCase() } as Party;
  }
  const id = asString(row.id).toUpperCase();
  const hostId = asString(row.host_id);
  if (!id || !hostId) return null;
  const members = Array.isArray(row.members)
    ? (row.members as RemoteMember[]).map((member) => mapMember(member, hostId)).filter((m): m is PartyMember => !!m)
    : [];
  const deposits = Array.isArray(row.escrow_deposits)
    ? (row.escrow_deposits as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  const status = asString(row.status, 'waiting');
  if (status === 'closed') return null;
  return {
    id,
    gameSlug: asGameSlug(row.game_slug),
    capacity: asNumber(row.capacity, 5),
    entry: asNumber(row.entry),
    hostId,
    createdAt: asNumber(row.created_at, Date.now()),
    status: status === 'live' ? 'live' : status === 'starting' ? 'starting' : 'waiting',
    visibility: asString(row.visibility) === 'public' ? 'public' : 'private',
    members: members.map((member) => ({ ...member, isHost: member.id === hostId })),
    escrowPda: asString(row.escrow_pda) || undefined,
    escrowDeposits: deposits,
    entryLamports: asNumber(row.entry_lamports) || undefined,
    gamePath: asString(row.game_path) || undefined,
  };
}

export async function fetchPublicParties(): Promise<PublicPartyListing[] | null> {
  try {
    const data = await apiJson<{ parties: unknown }>('/api/parties');
    return mapPublicListings(data.parties);
  } catch {
    return null;
  }
}

export async function fetchParty(partyId: string): Promise<Party | null> {
  try {
    const data = await apiJson<{ party: unknown }>(`/api/parties/${partyId.toUpperCase()}`);
    return mapRemoteParty(data.party);
  } catch {
    return null;
  }
}

export async function publishPartyState(party: Party): Promise<void> {
  if (party.status !== 'waiting') return;
  try {
    await apiJson('/api/parties', {
      method: 'POST',
      body: JSON.stringify({
        id: party.id.toUpperCase(),
        gameSlug: party.gameSlug,
        capacity: party.capacity,
        entry: party.entry,
        entryLamports: party.entryLamports ?? null,
        visibility: party.visibility,
        escrowPda: party.escrowPda ?? null,
        escrowDeposits: party.escrowDeposits ?? [],
      }),
    });
  } catch (err) {
    console.warn('publish_party', err instanceof Error ? err.message : err);
  }
}

export async function joinPartyState(
  partyId: string,
  member: PartyMember,
): Promise<{ party: Party | null; error: string | null }> {
  try {
    const data = await apiJson<{ party: unknown }>(`/api/parties/${partyId.toUpperCase()}/join`, {
      method: 'POST',
      body: JSON.stringify({
        username: member.username,
        avatar: member.avatar,
        color: member.color,
      }),
    });
    return { party: mapRemoteParty(data.party), error: null };
  } catch (err) {
    return { party: null, error: err instanceof Error ? err.message : 'Could not join party' };
  }
}

export async function leavePartyState(partyId: string, _userId?: string): Promise<void> {
  try {
    await apiJson(`/api/parties/${partyId.toUpperCase()}/leave`, { method: 'POST' });
  } catch (err) {
    console.warn('leave_party', err instanceof Error ? err.message : err);
  }
}

export function leavePartyKeepalive(partyId: string): void {
  const token = getSessionToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  void fetch(apiUrl(`/api/parties/${partyId.toUpperCase()}/leave`), {
    method: 'POST',
    headers,
    body: '{}',
    keepalive: true,
  }).catch(() => undefined);
}

export async function touchPartyState(partyId: string, _hostId?: string): Promise<void> {
  try {
    await apiJson(`/api/parties/${partyId.toUpperCase()}/touch`, { method: 'POST' });
  } catch (err) {
    console.warn('touch_party', err instanceof Error ? err.message : err);
  }
}

export async function reportPartyDeposit(partyId: string): Promise<Party | null> {
  try {
    const data = await apiJson<{ party: unknown }>(`/api/parties/${partyId.toUpperCase()}/deposit`, {
      method: 'POST',
    });
    return mapRemoteParty(data.party);
  } catch (err) {
    console.warn('deposit_party', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function startPartyState(partyId: string, hostIdOrPath: string, gamePath?: string): Promise<void> {
  const path = gamePath ?? hostIdOrPath;
  try {
    await apiJson(`/api/parties/${partyId.toUpperCase()}/start`, {
      method: 'POST',
      body: JSON.stringify({ gamePath: path }),
    });
  } catch (err) {
    console.warn('start_party', err instanceof Error ? err.message : err);
  }
}
