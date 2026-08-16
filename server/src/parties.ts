import { prisma } from './db.ts';
import { isGameSlug } from '../../shared/games.ts';
import type { Party } from '../../src/types/party.ts';
import { fetchEscrowState } from './escrowOracle.ts';

function code(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += alphabet[Math.floor(Math.random() * alphabet.length)];
  return id;
}

function toParty(row: {
  id: string;
  gameSlug: string;
  capacity: number;
  entry: number;
  entryLamports: bigint | null;
  hostId: string;
  status: string;
  visibility: string;
  escrowPda: string | null;
  escrowDeposits: unknown;
  gamePath: string | null;
  createdAt: Date;
  members: Array<{
    userId: string;
    username: string;
    avatar: string;
    color: string;
    isHost: boolean;
    joinedAt: Date;
  }>;
}): Party {
  const deposits = Array.isArray(row.escrowDeposits)
    ? (row.escrowDeposits as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  return {
    id: row.id,
    gameSlug: isGameSlug(row.gameSlug) ? row.gameSlug : 'bomb-party',
    capacity: row.capacity,
    entry: row.entry,
    hostId: row.hostId,
    createdAt: row.createdAt.getTime(),
    status: row.status === 'live' ? 'live' : row.status === 'starting' ? 'starting' : 'waiting',
    visibility: row.visibility === 'public' ? 'public' : 'private',
    members: row.members.map((m) => ({
      id: m.userId,
      username: m.username,
      avatar: m.avatar,
      color: m.color,
      isHost: m.isHost,
      joinedAt: m.joinedAt.getTime(),
    })),
    escrowPda: row.escrowPda ?? undefined,
    escrowDeposits: deposits,
    entryLamports: row.entryLamports != null ? Number(row.entryLamports) : undefined,
    gamePath: row.gamePath ?? undefined,
  };
}

async function loadParty(id: string) {
  return prisma.party.findUnique({
    where: { id: id.toUpperCase() },
    include: { members: { orderBy: { joinedAt: 'asc' } } },
  });
}

export async function createParty(opts: {
  hostId: string;
  username: string;
  avatar: string;
  color: string;
  gameSlug: string;
  capacity: number;
  visibility: string;
  entry: number;
  entryLamports?: number | null;
  id?: string;
  escrowPda?: string | null;
}): Promise<Party> {
  const id = (opts.id || code()).toUpperCase();
  const existing = await prisma.party.findUnique({ where: { id } });
  if (existing && existing.status !== 'waiting') {
    throw new Error('party closed');
  }
  if (existing && existing.hostId !== opts.hostId) {
    throw new Error('party code in use');
  }
  const gameSlug = opts.gameSlug === 'tower' ? 'tower' : 'bomb-party';
  const capacity = Math.max(2, Math.min(20, opts.capacity));
  const row = await prisma.party.upsert({
    where: { id },
    create: {
      id,
      gameSlug,
      capacity,
      entry: Math.max(0, opts.entry),
      entryLamports: opts.entryLamports != null ? BigInt(Math.round(opts.entryLamports)) : null,
      hostId: opts.hostId,
      status: 'waiting',
      visibility: opts.visibility === 'public' ? 'public' : 'private',
      members: {
        create: {
          userId: opts.hostId,
          username: opts.username,
          avatar: opts.avatar,
          color: opts.color,
          isHost: true,
        },
      },
    },
    update: {
      gameSlug,
      capacity,
      entry: Math.max(0, opts.entry),
      entryLamports: opts.entryLamports != null ? BigInt(Math.round(opts.entryLamports)) : null,
      visibility: opts.visibility === 'public' ? 'public' : 'private',
      gamePath: null,
      updatedAt: new Date(),
      ...(opts.escrowPda ? { escrowPda: opts.escrowPda } : {}),
    },
    include: { members: { orderBy: { joinedAt: 'asc' } } },
  });
  await prisma.partyMember.upsert({
    where: { partyId_userId: { partyId: id, userId: opts.hostId } },
    create: {
      partyId: id,
      userId: opts.hostId,
      username: opts.username,
      avatar: opts.avatar,
      color: opts.color,
      isHost: true,
    },
    update: {
      username: opts.username,
      avatar: opts.avatar,
      color: opts.color,
      isHost: true,
    },
  });
  const full = await loadParty(id);
  if (opts.visibility === 'public') await closeEmptyPublicLobbies(opts.hostId, id);
  return toParty(full ?? row);
}

async function closeEmptyPublicLobbies(hostId: string, exceptId?: string): Promise<void> {
  const open = await prisma.party.findMany({
    where: {
      hostId,
      status: 'waiting',
      visibility: 'public',
      ...(exceptId ? { id: { not: exceptId.toUpperCase() } } : {}),
    },
    include: { members: true },
  });
  const ids = open.filter((p) => p.members.length <= 1).map((p) => p.id);
  if (!ids.length) return;
  await prisma.party.updateMany({ where: { id: { in: ids } }, data: { status: 'closed' } });
  await prisma.partyMember.deleteMany({ where: { partyId: { in: ids } } });
}

export async function joinParty(
  partyId: string,
  member: { id: string; username: string; avatar: string; color: string },
): Promise<Party> {
  const id = partyId.toUpperCase();
  const room = await loadParty(id);
  if (!room) throw new Error('party not found');
  if (room.status !== 'waiting') throw new Error('party already started');
  if (!room.members.some((m) => m.userId === member.id) && room.members.length >= room.capacity) {
    throw new Error('party is full');
  }
  await prisma.partyMember.upsert({
    where: { partyId_userId: { partyId: id, userId: member.id } },
    create: {
      partyId: id,
      userId: member.id,
      username: member.username,
      avatar: member.avatar,
      color: member.color,
      isHost: member.id === room.hostId,
    },
    update: {
      username: member.username,
      avatar: member.avatar,
      color: member.color,
    },
  });
  await prisma.party.update({ where: { id }, data: { updatedAt: new Date() } });
  const next = await loadParty(id);
  if (!next) throw new Error('party not found');
  return toParty(next);
}

export async function leaveParty(partyId: string, userId: string): Promise<void> {
  const id = partyId.toUpperCase();
  const room = await prisma.party.findUnique({ where: { id } });
  if (!room) return;
  if (room.hostId === userId) {
    if (room.status === 'waiting') {
      await prisma.party.update({ where: { id }, data: { status: 'closed' } });
      await prisma.partyMember.deleteMany({ where: { partyId: id } });
      await closeEmptyPublicLobbies(userId);
    }
    return;
  }
  await prisma.partyMember.deleteMany({ where: { partyId: id, userId } });
  const deposits = Array.isArray(room.escrowDeposits)
    ? (room.escrowDeposits as unknown[]).filter((v): v is string => typeof v === 'string' && v !== userId)
    : [];
  await prisma.party.update({
    where: { id },
    data: { escrowDeposits: deposits, updatedAt: new Date() },
  });
}

export async function touchParty(partyId: string, hostId: string): Promise<void> {
  await prisma.party.updateMany({
    where: { id: partyId.toUpperCase(), hostId, status: 'waiting' },
    data: { updatedAt: new Date() },
  });
}

export async function recordDeposit(partyId: string, userId: string): Promise<Party> {
  const id = partyId.toUpperCase();
  const room = await loadParty(id);
  if (!room) throw new Error('party not found');
  if (room.status !== 'waiting') throw new Error('party already started');
  if (!room.members.some((m) => m.userId === userId)) throw new Error('not in party');
  if (room.entryLamports != null && room.entryLamports > 0n) {
    const escrow = await fetchEscrowState(id);
    if (!escrow || escrow.pda !== room.escrowPda) throw new Error('escrow account not verified');
    if (escrow.entryLamports !== Number(room.entryLamports)) throw new Error('escrow stake mismatch');
    if (escrow.status > 1) throw new Error('escrow is closed');
    if (!escrow.players.includes(userId)) throw new Error('deposit not confirmed on-chain');
  }
  const deposits = Array.isArray(room.escrowDeposits)
    ? (room.escrowDeposits as unknown[]).filter((v): v is string => typeof v === 'string')
    : [];
  if (!deposits.includes(userId)) deposits.push(userId);
  await prisma.party.update({
    where: { id },
    data: { escrowDeposits: deposits, updatedAt: new Date() },
  });
  const next = await loadParty(id);
  if (!next) throw new Error('party not found');
  return toParty(next);
}

export async function startParty(partyId: string, hostId: string, gamePath: string): Promise<Party> {
  const id = partyId.toUpperCase();
  const room = await getParty(id);
  if (!room || room.hostId !== hostId || room.status !== 'waiting') throw new Error('cannot start party');
  await assertEscrowReady(room);
  const updated = await prisma.party.updateMany({
    where: { id, hostId, status: 'waiting' },
    data: { status: 'live', gamePath, updatedAt: new Date() },
  });
  if (!updated.count) throw new Error('cannot start party');
  const next = await loadParty(id);
  if (!next) throw new Error('party not found');
  return toParty(next);
}

export async function assertEscrowReady(party: Party): Promise<void> {
  if (!party.entryLamports || party.entryLamports <= 0) return;
  const escrow = await fetchEscrowState(party.id);
  if (!escrow || escrow.pda !== party.escrowPda) throw new Error('escrow account not verified');
  if (escrow.entryLamports !== party.entryLamports) throw new Error('escrow stake mismatch');
  if (escrow.status !== 1) throw new Error('escrow must be locked before the match starts');
  const memberIds = party.members.map((member) => member.id);
  if (memberIds.length !== party.capacity) throw new Error('paid matches require a full party');
  if (
    escrow.players.length !== memberIds.length ||
    memberIds.some((id) => !escrow.players.includes(id))
  ) {
    throw new Error('all player deposits must be confirmed on-chain');
  }
}

export async function getParty(partyId: string): Promise<Party | null> {
  const row = await loadParty(partyId);
  if (!row || row.status === 'closed') return null;
  return toParty(row);
}

export async function listPublicParties() {
  const cutoff = new Date(Date.now() - 30 * 60 * 1000);
  const hostOnlyCutoff = new Date(Date.now() - 2 * 60 * 1000);
  const rows = await prisma.party.findMany({
    where: { visibility: 'public', status: 'waiting', updatedAt: { gt: cutoff } },
    include: { members: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return rows
    .filter((p) => {
      if (p.members.length === 0 || p.members.length >= p.capacity) return false;
      if (p.members.length === 1 && p.updatedAt < hostOnlyCutoff) return false;
      return true;
    })
    .map((p) => {
      const host = p.members.find((m) => m.isHost);
      return {
        id: p.id,
        gameSlug: p.gameSlug,
        capacity: p.capacity,
        entry: p.entry,
        entryLamports: p.entryLamports != null ? Number(p.entryLamports) : null,
        hostId: p.hostId,
        hostName: host?.username ?? 'Host',
        memberCount: p.members.length,
        createdAt: p.createdAt.getTime(),
      };
    });
}

export async function recordSelfResult(opts: {
  userId: string;
  username: string;
  avatar: string;
  color: string;
  won: boolean;
  prize: number;
  practice: boolean;
}): Promise<void> {
  const { userId } = opts;
  const row = await prisma.leaderboardRow.findUnique({ where: { userId } });
  await prisma.leaderboardRow.upsert({
    where: { userId },
    create: {
      userId,
      username: opts.username,
      avatar: opts.avatar,
      color: opts.color,
      wins: opts.won ? 1 : 0,
      gamesPlayed: 1,
      biggestWin: opts.won ? Math.max(0, opts.prize) : 0,
      streak: opts.won ? 1 : 0,
    },
    update: {
      username: opts.username,
      avatar: opts.avatar,
      color: opts.color,
      gamesPlayed: { increment: 1 },
      wins: opts.won ? { increment: 1 } : undefined,
      streak: opts.won ? { increment: 1 } : 0,
      biggestWin: opts.won ? Math.max(row?.biggestWin ?? 0, opts.prize) : undefined,
    },
  });
  const { applyXp } = await import('./profile.ts');
  await applyXp(userId, opts.won ? (opts.practice ? 120 : 250) : 80);
}
