import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { TowerEngine, type TowerFighter } from '../../shared/tower/engine.ts';
import { SNAPSHOT_EVERY, TICK_HZ, QUEUE_BACKFILL_MS } from '../../shared/tower/constants.ts';
import { TOWER_ENTRY_CREDITS, TOWER_MATCH_SIZE } from '../../shared/games.ts';
import type { ClientMsg, ServerMsg } from '../../shared/protocol.ts';
import type { TowerInput } from '../../shared/tower/types.ts';
import { settleMatch, getBalance } from './ledger.ts';
import { TOWER_BOT_AVATARS, TOWER_BOT_COLORS, TOWER_BOT_NAMES } from '../../shared/tower/bots.ts';

type Sock = WebSocket & { userId?: string; username?: string; avatar?: string; color?: string };

interface Queued {
  sock: Sock;
  since: number;
}

interface LiveMatch {
  id: string;
  engine: TowerEngine;
  sockets: Map<string, Sock>;
  timer: ReturnType<typeof setInterval>;
}

const queue: Queued[] = [];
const matches = new Map<string, LiveMatch>();
const parties = new Map<string, { host: string; members: Sock[] }>();

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

async function startMatch(humans: Sock[]): Promise<void> {
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
  const engine = new TowerEngine({ seed, matchId: id, fighters });
  const sockets = new Map<string, Sock>();
  for (const s of humans) {
    if (s.userId) sockets.set(s.userId, s);
    send(s, { type: 'match_start', matchId: id, seed, you: s.userId! });
  }

  const live: LiveMatch = { id, engine, sockets, timer: setInterval(() => tick(live), 1000 / TICK_HZ) };
  matches.set(id, live);
}

function tick(live: LiveMatch): void {
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
      .catch((err) => console.error('settle failed', err))
      .finally(() => {
        const msg: ServerMsg = { type: 'match_end', result };
        for (const sock of live.sockets.values()) send(sock, msg);
        matches.delete(live.id);
      });
  }
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
    const p = parties.get(msg.code.toUpperCase());
    if (!p) {
      send(sock, { type: 'error', message: 'Party not found' });
      return;
    }
    if (!p.members.includes(sock)) p.members.push(sock);
    for (const m of p.members) {
      send(m, { type: 'party', code: msg.code.toUpperCase(), members: partyMembers(msg.code.toUpperCase()) });
    }
    return;
  }

  if (msg.type === 'party_start') {
    const found = [...parties.entries()].find(([, p]) => p.host === sock.userId);
    if (!found) return;
    const [, party] = found;
    await startMatch(party.members.filter((m) => m.readyState === m.OPEN && m.userId));
    parties.delete(found[0]);
    return;
  }

  if (msg.type === 'input') {
    const live = matches.get(msg.matchId);
    if (!live) return;
    live.engine.setInput(sock.userId, msg.input as TowerInput);
    return;
  }

  if (msg.type === 'leave_match') {
    const live = matches.get(msg.matchId);
    if (!live) return;
    live.engine.forfeit(sock.userId);
    live.sockets.delete(sock.userId);
  }
}

export function detachSocket(sock: Sock): void {
  const i = queue.findIndex((q) => q.sock === sock);
  if (i >= 0) queue.splice(i, 1);
  if (!sock.userId) return;
  // A dropped connection should not leave a statue standing on a platform.
  for (const live of matches.values()) {
    if (!live.sockets.has(sock.userId)) continue;
    live.engine.forfeit(sock.userId);
    live.sockets.delete(sock.userId);
  }
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

export function attachUser(
  sock: Sock,
  user: { id: string; username: string; avatar: string; color: string },
): void {
  sock.userId = user.id;
  sock.username = user.username;
  sock.avatar = user.avatar;
  sock.color = user.color;
  send(sock, { type: 'hello', ok: true });
}
