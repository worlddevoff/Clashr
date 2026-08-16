import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { TowerEngine, type TowerFighter } from '../../shared/tower/engine.ts';
import { SNAPSHOT_EVERY, TICK_HZ, QUEUE_BACKFILL_MS } from '../../shared/tower/constants.ts';
import { TOWER_ENTRY_CREDITS, TOWER_MATCH_SIZE } from '../../shared/games.ts';
import type { BombMatchResult, ClientMsg, ServerMsg } from '../../shared/protocol.ts';
import type { TowerInput } from '../../shared/tower/types.ts';
import { BombPartyEngine, type BombPartySeedPlayer } from '../../src/game/BombPartyEngine.ts';
import { getBombMap } from '../../src/game/bombMaps.ts';
import { settleMatch, getBalance, chargeMatchEntries, settleBombMatch } from './ledger.ts';
import { assertEscrowReady, getParty } from './parties.ts';
import { queueEscrowPayout } from './escrowPayouts.ts';
import { TOWER_BOT_AVATARS, TOWER_BOT_COLORS, TOWER_BOT_NAMES } from '../../shared/tower/bots.ts';

type Sock = WebSocket & { userId?: string; username?: string; avatar?: string; color?: string };

interface Queued {
  sock: Sock;
  since: number;
}

type LiveMatch =
  | {
      kind: 'tower';
      id: string;
      seed: number;
      engine: TowerEngine;
      sockets: Map<string, Sock>;
      timer: ReturnType<typeof setInterval>;
      partyId?: string;
      escrowPda?: string;
    }
  | {
      kind: 'bomb';
      id: string;
      seed: number;
      engine: BombPartyEngine;
      sockets: Map<string, Sock>;
      timer: ReturnType<typeof setInterval>;
      partyId: string;
      escrowPda?: string;
      entryLamports?: number;
      players: BombPartySeedPlayer[];
    };

const BOMB_ARENA = { width: 900, height: 620 };
const BOMB_HZ = 20;
const FEE_BPS = 500;
const RECONNECT_GRACE_MS = 15_000;

const queue: Queued[] = [];
const matches = new Map<string, LiveMatch>();
const parties = new Map<string, { host: string; members: Sock[]; game?: 'tower' | 'bomb-party' }>();
const reconnecting = new Map<string, { matchId: string; timer: ReturnType<typeof setTimeout> }>();

function send(sock: Sock, msg: ServerMsg): void {
  if (sock.readyState === sock.OPEN) sock.send(JSON.stringify(msg));
}

function botFighter(i: number): TowerFighter {
  return {
    id: `bot-${i}-${randomUUID().slice(0, 6)}`,
    username: `Bot ${TOWER_BOT_NAMES[i % TOWER_BOT_NAMES.length]}`,
    avatar: TOWER_BOT_AVATARS[i % TOWER_BOT_AVATARS.length],
    color: TOWER_BOT_COLORS[i % TOWER_BOT_COLORS.length],
    isBot: true,
  };
}

function bombBot(i: number): BombPartySeedPlayer {
  return {
    id: `bot-${i}-${randomUUID().slice(0, 6)}`,
    username: `Bot ${TOWER_BOT_NAMES[i % TOWER_BOT_NAMES.length]}`,
    avatar: TOWER_BOT_AVATARS[i % TOWER_BOT_AVATARS.length],
    color: TOWER_BOT_COLORS[i % TOWER_BOT_COLORS.length],
    isHuman: false,
  };
}

function solPool(humans: number, lamports?: number) {
  if (humans < 2 || !lamports) return { gross: 0, platformFee: 0, prize: 0 };
  const gross = (humans * lamports) / 1e9;
  const platformFee = (gross * FEE_BPS) / 10_000;
  return { gross, platformFee, prize: gross - platformFee };
}

async function startMatch(
  humans: Sock[],
  opts?: { partyId?: string; escrowPda?: string },
): Promise<void> {
  const fighters: TowerFighter[] = humans.map((s) => ({
    id: s.userId!,
    username: s.username || 'Player',
    avatar: s.avatar || '🐸',
    color: s.color || '#22e5ff',
    isBot: false,
  }));
  while (fighters.length < TOWER_MATCH_SIZE) fighters.push(botFighter(fighters.length));

  const id = randomUUID();
  const seed = Math.floor(Math.random() * 1e9);
  try {
    await chargeMatchEntries(
      id,
      'tower',
      fighters.map((f) => ({
        id: f.id,
        username: f.username,
        avatar: f.avatar,
        color: f.color,
        isBot: f.isBot,
      })),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not start match';
    for (const s of humans) send(s, { type: 'error', message });
    return;
  }
  const engine = new TowerEngine({ seed, matchId: id, fighters });
  const sockets = new Map<string, Sock>();
  for (const s of humans) {
    if (s.userId) sockets.set(s.userId, s);
    send(s, { type: 'match_start', matchId: id, seed, you: s.userId!, game: 'tower' });
  }

  const live: LiveMatch = {
    kind: 'tower',
    id,
    seed,
    engine,
    sockets,
    timer: setInterval(() => tickTower(live as Extract<LiveMatch, { kind: 'tower' }>), 1000 / TICK_HZ),
    partyId: opts?.partyId,
    escrowPda: opts?.escrowPda,
  };
  matches.set(id, live);
}

async function startBombMatch(
  humans: Sock[],
  opts: { partyId: string; capacity: number; escrowPda?: string; entryLamports?: number },
): Promise<void> {
  const players: BombPartySeedPlayer[] = humans.map((s) => ({
    id: s.userId!,
    username: s.username || 'Player',
    avatar: s.avatar || '🐸',
    color: s.color || '#22e5ff',
    isHuman: true,
  }));
  const cap = Math.max(2, Math.min(20, opts.capacity || players.length));
  while (players.length < cap) players.push(bombBot(players.length));
  const id = randomUUID();
  const seed = Math.floor(Math.random() * 1e9);
  const map = getBombMap(seed, BOMB_ARENA.width, BOMB_ARENA.height);
  const engine = new BombPartyEngine(players, {
    arena: BOMB_ARENA,
    startTimer: 12,
    passTimeBonus: 0,
    humanId: players[0]?.id ?? 'host',
    countdownMs: 3000,
    hazards: map.hazards,
    mapId: map.id,
  });
  const sockets = new Map<string, Sock>();
  for (const s of humans) {
    if (s.userId) sockets.set(s.userId, s);
    send(s, { type: 'match_start', matchId: id, seed, you: s.userId!, game: 'bomb-party' });
  }
  const live: Extract<LiveMatch, { kind: 'bomb' }> = {
    kind: 'bomb',
    id,
    seed,
    engine,
    sockets,
    timer: setInterval(() => tickBomb(live), 1000 / BOMB_HZ),
    partyId: opts.partyId,
    escrowPda: opts.escrowPda,
    entryLamports: opts.entryLamports,
    players,
  };
  matches.set(id, live);
}

function tickTower(live: Extract<LiveMatch, { kind: 'tower' }>): void {
  live.engine.step();
  if (live.engine.tick % SNAPSHOT_EVERY === 0) {
    const snap = live.engine.snapshot();
    const msg: ServerMsg = { type: 'snapshot', matchId: live.id, snap };
    const raw = JSON.stringify(msg);
    for (const sock of live.sockets.values()) {
      if (sock.readyState === sock.OPEN) sock.send(raw);
    }
  }
  if (live.engine.finished && live.engine.result) {
    clearInterval(live.timer);
    const result = live.engine.result;
    void settleMatch(result)
      .then(async () => {
        if (live.escrowPda && live.partyId) {
          const winner = result.participants.find((p) => p.id === result.winnerId);
          await queueEscrowPayout({
            matchId: live.id,
            partyId: live.partyId,
            winnerAddress: winner?.isBot ? null : result.winnerId,
            house: !winner || winner.isBot,
          });
        }
        const msg: ServerMsg = { type: 'match_end', result };
        for (const sock of live.sockets.values()) send(sock, msg);
      })
      .catch((err) => {
        console.error('settle failed', err);
        for (const sock of live.sockets.values()) {
          send(sock, { type: 'error', message: 'Match could not be settled. Credits were reserved.' });
        }
      })
      .finally(() => {
        matches.delete(live.id);
      });
  }
}

function tickBomb(live: Extract<LiveMatch, { kind: 'bomb' }>): void {
  live.engine.step(1000 / BOMB_HZ);
  const snap = live.engine.snapshot();
  const raw = JSON.stringify({ type: 'bomb_snapshot', matchId: live.id, snap } satisfies ServerMsg);
  for (const sock of live.sockets.values()) {
    if (sock.readyState === sock.OPEN) sock.send(raw);
  }
  if (!live.engine.finished()) return;
  clearInterval(live.timer);
  const winnerId = live.engine.winnerId();
  const winner = live.players.find((p) => p.id === winnerId) ?? live.players.find((p) => p.isHuman) ?? live.players[0];
  const humans = live.players.filter((p) => p.isHuman);
  const practice = humans.length < 2 || !live.escrowPda;
  const pool = practice ? { gross: 0, platformFee: 0, prize: 0 } : solPool(humans.length, live.entryLamports);
  const result: BombMatchResult = {
    matchId: live.id,
    winnerId,
    winner: winner?.username ?? 'Winner',
    winnerAvatar: winner?.avatar ?? '🐸',
    winnerColor: winner?.color ?? '#22e5ff',
    winnerIsBot: winner ? !winner.isHuman : true,
    prize: pool.prize,
    prizeCurrency: 'SOL',
    grossPool: pool.gross,
    platformFee: pool.platformFee,
    practiceMode: practice,
    survivedSec: live.engine.getElapsedSec(),
    playerCount: live.players.length,
    players: live.players.map((p) => p.username),
    timestamp: Date.now(),
  };
  void (async () => {
    try {
      await settleBombMatch({
        matchId: live.id,
        winnerId,
        practice,
        prize: pool.prize,
        players: live.players.map((p) => ({
          id: p.id,
          username: p.username,
          avatar: p.avatar,
          color: p.color,
          isBot: !p.isHuman,
        })),
      });
      if (live.escrowPda && live.partyId) {
        await queueEscrowPayout({
          matchId: live.id,
          partyId: live.partyId,
          winnerAddress: result.winnerIsBot ? null : winnerId,
          house: result.winnerIsBot || !winnerId,
        });
      }
      const msg: ServerMsg = { type: 'bomb_end', result };
      for (const sock of live.sockets.values()) send(sock, msg);
    } catch (err) {
      console.error('bomb settle failed', err);
      for (const sock of live.sockets.values()) {
        send(sock, { type: 'error', message: 'Match could not be recorded.' });
      }
    } finally {
      matches.delete(live.id);
    }
  })();
}

export async function handleMessage(sock: Sock, raw: string): Promise<void> {
  let msg: ClientMsg;
  try {
    msg = JSON.parse(raw) as ClientMsg;
  } catch {
    send(sock, { type: 'error', message: 'Bad message' });
    return;
  }

  if (msg.type === 'ping') {
    send(sock, { type: 'pong', t: msg.t });
    return;
  }

  if (!sock.userId) {
    send(sock, { type: 'error', message: 'Auth required' });
    return;
  }

  if (msg.type === 'queue') {
    const bal = await getBalance(sock.userId);
    if (bal < TOWER_ENTRY_CREDITS) {
      send(sock, { type: 'error', message: 'Not enough demo credits' });
      return;
    }
    const prior = queue.findIndex((q) => q.sock.userId === sock.userId);
    if (prior >= 0) queue.splice(prior, 1);
    if (!queue.some((q) => q.sock === sock)) queue.push({ sock, since: Date.now() });
    send(sock, { type: 'queued', position: queue.length, players: queue.length });
    flushQueue();
    return;
  }

  if (msg.type === 'leave_queue') {
    const i = queue.findIndex((q) => q.sock === sock);
    if (i >= 0) queue.splice(i, 1);
    return;
  }

  if (msg.type === 'party_create') {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    parties.set(code, { host: sock.userId, members: [sock] });
    send(sock, {
      type: 'party',
      code,
      members: partyMembers(code),
    });
    return;
  }

  if (msg.type === 'party_join') {
    const code = msg.code.toUpperCase();
    const db = await getParty(code).catch(() => null);
    if (!db || !db.members.some((member) => member.id === sock.userId)) {
      send(sock, { type: 'error', message: 'Party membership required' });
      return;
    }
    let p = parties.get(code);
    if (!p) {
      p = { host: db.hostId, members: [], game: db.gameSlug };
      parties.set(code, p);
    }
    p.host = db.hostId;
    p.game = db.gameSlug;
    if (!p.members.includes(sock)) p.members.push(sock);
    for (const m of p.members) {
      send(m, { type: 'party', code, members: partyMembers(code) });
    }
    return;
  }

  if (msg.type === 'party_leave') {
    for (const [code, p] of parties) {
      const next = p.members.filter((m) => m !== sock);
      if (next.length === p.members.length) continue;
      p.members = next;
      if (!next.length) parties.delete(code);
      else {
        for (const m of next) send(m, { type: 'party', code, members: partyMembers(code) });
      }
    }
    return;
  }

  if (msg.type === 'party_start') {
    const code = msg.code?.toUpperCase();
    const found = code
      ? ([code, parties.get(code)] as const)
      : [...parties.entries()].find(([, p]) => p.host === sock.userId);
    if (!found || !found[1]) return;
    const db = await getParty(found[0]).catch(() => null);
    if (!db || db.hostId !== sock.userId) {
      send(sock, { type: 'error', message: 'Only the party host can start the match' });
      return;
    }
    try {
      await assertEscrowReady(db);
    } catch (err) {
      send(sock, { type: 'error', message: err instanceof Error ? err.message : 'Escrow not ready' });
      return;
    }
    const allowedMembers = new Set(db.members.map((member) => member.id));
    const members = found[1].members.filter(
      (member) => member.readyState === member.OPEN && member.userId && allowedMembers.has(member.userId),
    );
    if (db.entryLamports && members.length !== db.members.length) {
      send(sock, { type: 'error', message: 'Waiting for every paid player to connect' });
      return;
    }
    const game = db.gameSlug === 'bomb-party' ? 'bomb-party' : 'tower';
    if (game === 'bomb-party') {
      await startBombMatch(members, {
        partyId: found[0],
        capacity: db?.capacity ?? Math.max(2, members.length),
        escrowPda: db?.escrowPda,
        entryLamports: db?.entryLamports,
      });
    } else {
      await startMatch(members, {
        partyId: found[0],
        escrowPda: db?.escrowPda,
      });
    }
    parties.delete(found[0]);
    return;
  }

  if (msg.type === 'input') {
    const live = matches.get(msg.matchId);
    if (!live || live.kind !== 'tower') return;
    live.engine.setInput(sock.userId, msg.input as TowerInput);
    return;
  }

  if (msg.type === 'bomb_input') {
    const live = matches.get(msg.matchId);
    if (!live || live.kind !== 'bomb') return;
    if (msg.key) live.engine.setKey(sock.userId, msg.key.dir, msg.key.pressed);
    if (msg.move) live.engine.setMoveTarget(sock.userId, msg.move);
    if (msg.taunt) live.engine.taunt(sock.userId, msg.taunt);
    return;
  }

  if (msg.type === 'leave_match') {
    const live = matches.get(msg.matchId);
    if (!live) return;
    if (live.kind === 'tower') live.engine.forfeit(sock.userId);
    else live.engine.forfeit(sock.userId);
    live.sockets.delete(sock.userId);
  }
}

export function detachSocket(sock: Sock): void {
  const i = queue.findIndex((q) => q.sock === sock);
  if (i >= 0) queue.splice(i, 1);
  if (!sock.userId) return;
  const userId = sock.userId;
  for (const [code, p] of parties) {
    const next = p.members.filter((m) => m !== sock);
    if (next.length === p.members.length) continue;
    p.members = next;
    if (!next.length) parties.delete(code);
    else {
      for (const m of next) send(m, { type: 'party', code, members: partyMembers(code) });
    }
  }
  for (const live of matches.values()) {
    if (!live.sockets.has(userId)) continue;
    if (live.sockets.get(userId) !== sock) continue;
    live.sockets.delete(userId);
    const existing = reconnecting.get(userId);
    if (existing) clearTimeout(existing.timer);
    const timer = setTimeout(() => {
      reconnecting.delete(userId);
      const still = matches.get(live.id);
      if (!still || still.sockets.has(userId)) return;
      still.engine.forfeit(userId);
    }, RECONNECT_GRACE_MS);
    reconnecting.set(userId, { matchId: live.id, timer });
  }
}

function resumeMatch(sock: Sock, userId: string): boolean {
  const pending = reconnecting.get(userId);
  if (pending) {
    clearTimeout(pending.timer);
    reconnecting.delete(userId);
    const live = matches.get(pending.matchId);
    if (live) {
      live.sockets.set(userId, sock);
      send(sock, {
        type: 'match_start',
        matchId: live.id,
        seed: live.seed,
        you: userId,
        game: live.kind === 'bomb' ? 'bomb-party' : 'tower',
      });
      if (live.kind === 'tower') {
        send(sock, { type: 'snapshot', matchId: live.id, snap: live.engine.snapshot() });
      } else {
        send(sock, { type: 'bomb_snapshot', matchId: live.id, snap: live.engine.snapshot() });
      }
      return true;
    }
  }
  for (const live of matches.values()) {
    const inTower = live.kind === 'tower' && live.engine.snapshot().players.some((p) => p.id === userId && p.alive);
    const inBomb = live.kind === 'bomb' && live.players.some((p) => p.id === userId && p.isHuman);
    if (!inTower && !inBomb) continue;
    if (live.sockets.has(userId) && live.sockets.get(userId) !== sock) continue;
    live.sockets.set(userId, sock);
    send(sock, {
      type: 'match_start',
      matchId: live.id,
      seed: live.seed,
      you: userId,
      game: live.kind === 'bomb' ? 'bomb-party' : 'tower',
    });
    if (live.kind === 'tower') send(sock, { type: 'snapshot', matchId: live.id, snap: live.engine.snapshot() });
    else send(sock, { type: 'bomb_snapshot', matchId: live.id, snap: live.engine.snapshot() });
    return true;
  }
  return false;
}

export function attachUser(
  sock: Sock,
  user: { id: string; username: string; avatar: string; color: string },
): void {
  sock.userId = user.id;
  sock.username = user.username;
  sock.avatar = user.avatar;
  sock.color = user.color;
  send(sock, { type: 'hello', ok: true });
  resumeMatch(sock, user.id);
}

function partyMembers(code: string) {
  const p = parties.get(code);
  return (
    p?.members
      .filter((s) => s.userId)
      .map((s) => ({
        id: s.userId!,
        username: s.username || 'Player',
        avatar: s.avatar || '🐸',
        color: s.color || '#22e5ff',
      })) ?? []
  );
}

function flushQueue(): void {
  if (queue.length >= TOWER_MATCH_SIZE) {
    const batch = queue.splice(0, TOWER_MATCH_SIZE);
    void startMatch(batch.map((q) => q.sock));
    return;
  }
  const oldest = queue[0];
  if (oldest && Date.now() - oldest.since >= QUEUE_BACKFILL_MS) {
    const batch = queue.splice(0, queue.length);
    void startMatch(batch.map((q) => q.sock));
  }
}

setInterval(flushQueue, 400);

