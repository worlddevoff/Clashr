import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, type WebSocket } from 'ws';
import { prisma } from './db.ts';
import { challengeMessage, issueNonce, loginWithSignature, userFromToken } from './auth.ts';
import { ensureHouse, getBalance } from './ledger.ts';
import { attachUser, detachSocket, handleMessage } from './matchmaking.ts';
import { toClientUser, updateProfile } from './profile.ts';
import {
  createParty,
  getParty,
  joinParty,
  leaveParty,
  listPublicParties,
  startParty,
  touchParty,
} from './parties.ts';
import { CREDITS_DISCLAIMER, TOWER_STARTING_CREDITS } from '../../shared/games.ts';
import { simulatePrizePool } from '../../shared/tower/prize.ts';
import { houseCanSettle } from './escrowOracle.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);
const IS_PROD = process.env.NODE_ENV === 'production';

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY !== '0') app.set('trust proxy', 1);

const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function originAllowed(origin: string | undefined, reqHost?: string): boolean {
  if (!origin) return true;
  if (corsOrigins.includes(origin)) return true;
  try {
    const host = new URL(origin).host;
    if (reqHost && (host === reqHost || host === reqHost.split(',')[0]?.trim())) return true;
  } catch {
    return false;
  }
  return !IS_PROD && corsOrigins.length === 0;
}

app.use(
  cors({
    origin: (origin, cb) => cb(null, originAllowed(origin)),
    credentials: true,
  }),
);
app.use(express.json({ limit: '32kb' }));
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (IS_PROD) res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  next();
});

const rateHits = new Map<string, number[]>();
function tooMany(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const next = (rateHits.get(key) ?? []).filter((t) => now - t < windowMs);
  next.push(now);
  rateHits.set(key, next);
  return next.length > max;
}

function bearer(h?: string): string | undefined {
  if (!h) return undefined;
  return h.startsWith('Bearer ') ? h.slice(7) : h;
}

function fail(res: express.Response, status: number, err: unknown) {
  const raw = err instanceof Error ? err.message : 'request failed';
  const leak = /prisma|postgres|econn|database|password|secret|stack/i.test(raw);
  if (status >= 500 || leak) console.error(err);
  const message = status >= 500 || leak ? (status >= 500 ? 'server error' : 'request failed') : raw;
  res.status(status).json({ error: message });
}

async function requireUser(req: express.Request, res: express.Response) {
  const user = await userFromToken(bearer(req.headers.authorization));
  if (!user) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  return user;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, game: 'clashr', disclaimer: CREDITS_DISCLAIMER });
});

app.get('/api/config', (_req, res) => {
  res.json({
    solPots: houseCanSettle(),
    disclaimer: CREDITS_DISCLAIMER,
  });
});

app.get('/api/tower/economy', (_req, res) => {
  res.json({ ...simulatePrizePool(), starting: TOWER_STARTING_CREDITS, disclaimer: CREDITS_DISCLAIMER });
});

app.post('/api/auth/challenge', async (req, res) => {
  try {
    const ip = req.ip || 'x';
    if (tooMany(`ch:${ip}`, 20, 60_000)) return res.status(429).json({ error: 'slow down' });
    const address = String(req.body.address || '');
    if (address.length < 32) return res.status(400).json({ error: 'address required' });
    const nonce = await issueNonce(address);
    res.json({ nonce, message: challengeMessage(address, nonce) });
  } catch (e) {
    fail(res, 500, e);
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const ip = req.ip || 'x';
    if (tooMany(`login:${ip}`, 15, 60_000)) return res.status(429).json({ error: 'slow down' });
    const { address, nonce, signatureHex, username, avatar, color } = req.body;
    const out = await loginWithSignature({ address, nonce, signatureHex, username, avatar, color });
    const user = await toClientUser(out.userId);
    res.json({
      token: out.token,
      userId: out.userId,
      isNew: out.isNew,
      user,
      balance: user?.balance ?? 0,
      disclaimer: CREDITS_DISCLAIMER,
    });
  } catch (e) {
    fail(res, 400, e);
  }
});

app.get('/api/me', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const client = await toClientUser(user.id);
  const balance = client?.balance ?? (await getBalance(user.id));
  res.json({ user: client, balance, disclaimer: CREDITS_DISCLAIMER });
});

app.patch('/api/me', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const client = await updateProfile(user.id, {
      username: typeof req.body.username === 'string' ? req.body.username : undefined,
      avatar: typeof req.body.avatar === 'string' ? req.body.avatar : undefined,
      color: typeof req.body.color === 'string' ? req.body.color : undefined,
    });
    res.json({ user: client, balance: client?.balance ?? 0, disclaimer: CREDITS_DISCLAIMER });
  } catch (e) {
    fail(res, 400, e);
  }
});

async function leaderboardPayload() {
  const rows = await prisma.leaderboardRow.findMany({
    orderBy: [{ wins: 'desc' }, { biggestWin: 'desc' }],
    take: 50,
  });
  return {
    rows: rows.map((r, i) => ({
      id: r.userId,
      userId: r.userId,
      username: r.username,
      avatar: r.avatar,
      color: r.color,
      isBot: false,
      wins: r.wins,
      gamesPlayed: r.gamesPlayed,
      biggestWin: r.biggestWin,
      streak: r.streak,
      rank: i + 1,
    })),
    disclaimer: CREDITS_DISCLAIMER,
  };
}

app.get('/api/leaderboard', async (_req, res) => {
  res.json(await leaderboardPayload());
});

app.get('/api/tower/leaderboard', async (_req, res) => {
  res.json(await leaderboardPayload());
});

app.get('/api/history', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const rows = await prisma.matchParticipant.findMany({
    where: { userId: user.id },
    include: { match: true },
    orderBy: { match: { startedAt: 'desc' } },
    take: 20,
  });
  res.json({
    rows: rows.map((r) => ({
      gameNumber: 0,
      gameSlug: r.match.gameSlug,
      won: r.match.winnerId === user.id,
      prize: r.creditsWon,
      practice: r.match.practice,
      at: (r.match.finishedAt ?? r.match.startedAt).getTime(),
    })),
    disclaimer: CREDITS_DISCLAIMER,
  });
});

app.get('/api/tower/history', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const rows = await prisma.matchParticipant.findMany({
    where: { userId: user.id },
    include: { match: { include: { moments: true } } },
    orderBy: { match: { startedAt: 'desc' } },
    take: 20,
  });
  res.json({ rows, disclaimer: CREDITS_DISCLAIMER });
});

app.post('/api/matches/record', (_req, res) => {
  res.status(403).json({ error: 'matches are recorded by the server' });
});

app.get('/api/tower/moments', async (_req, res) => {
  const rows = await prisma.detectedMoment.findMany({
    orderBy: { id: 'desc' },
    take: 24,
  });
  res.json({ rows });
});

app.get('/api/tower/match/:id', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: { participants: true, events: true, moments: true },
  });
  if (!match || !match.participants.some((p) => p.userId === user.id)) {
    return res.status(404).json({ error: 'not found' });
  }
  res.json({ match, disclaimer: CREDITS_DISCLAIMER });
});

app.get('/api/parties', async (req, res) => {
  const ip = req.ip || 'x';
  if (tooMany(`plist:${ip}`, 60, 60_000)) return res.status(429).json({ error: 'slow down' });
  const parties = await listPublicParties();
  res.json({ parties });
});

app.post('/api/parties', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (tooMany(`party:${user.id}`, 20, 60_000)) return res.status(429).json({ error: 'slow down' });
  try {
    const party = await createParty({
      hostId: user.id,
      username: user.username,
      avatar: user.avatar,
      color: user.color,
      gameSlug: String(req.body.gameSlug || 'bomb-party'),
      capacity: Number(req.body.capacity) || 5,
      visibility: String(req.body.visibility || 'private'),
      entry: Number(req.body.entry) || 0,
      entryLamports: req.body.entryLamports != null ? Number(req.body.entryLamports) : null,
      id: typeof req.body.id === 'string' ? req.body.id : undefined,
    });
    res.json({ party });
  } catch (e) {
    fail(res, 400, e);
  }
});

app.get('/api/parties/:id', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (tooMany(`pget:${user.id}`, 60, 60_000)) return res.status(429).json({ error: 'slow down' });
  const party = await getParty(req.params.id);
  if (!party) return res.status(404).json({ error: 'party not found' });
  const isMember = party.members.some((m) => m.id === user.id);
  if (party.status !== 'waiting' && !isMember) {
    return res.status(404).json({ error: 'party not found' });
  }
  res.json({ party });
});

app.post('/api/parties/:id/join', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (tooMany(`join:${user.id}`, 40, 60_000)) return res.status(429).json({ error: 'slow down' });
  try {
    const party = await joinParty(req.params.id, {
      id: user.id,
      username: typeof req.body.username === 'string' ? req.body.username : user.username,
      avatar: typeof req.body.avatar === 'string' ? req.body.avatar : user.avatar,
      color: typeof req.body.color === 'string' ? req.body.color : user.color,
    });
    res.json({ party });
  } catch (e) {
    fail(res, 400, e);
  }
});

app.post('/api/parties/:id/leave', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    await leaveParty(req.params.id, user.id);
    res.json({ ok: true });
  } catch (e) {
    fail(res, 400, e);
  }
});

app.post('/api/parties/:id/touch', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    await touchParty(req.params.id, user.id);
    res.json({ ok: true });
  } catch (e) {
    fail(res, 400, e);
  }
});

app.post('/api/parties/:id/start', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const gamePath = String(req.body.gamePath || '');
    if (!gamePath.startsWith('/game/')) return res.status(400).json({ error: 'invalid game path' });
    const party = await startParty(req.params.id, user.id, gamePath);
    res.json({ party });
  } catch (e) {
    fail(res, 400, e);
  }
});

if (IS_PROD) {
  const dist = path.resolve(__dirname, '../../dist');
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get(/^(?!\/api\/|\/ws).*/, (_req, res, next) => {
      const index = path.join(dist, 'index.html');
      if (!fs.existsSync(index)) return next();
      res.sendFile(index);
    });
  }
}

const server = http.createServer(app);
const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: (info) => originAllowed(info.origin, info.req.headers.host),
});

wss.on('connection', async (ws: WebSocket, req) => {
  const url = new URL(req.url || '/', 'http://localhost');
  const token = url.searchParams.get('token') || '';
  const user = await userFromToken(token);
  if (!user) {
    ws.close(4001, 'unauthorized');
    return;
  }
  attachUser(ws, user);
  ws.on('message', (data) => {
    void handleMessage(ws, String(data));
  });
  ws.on('close', () => detachSocket(ws));
});

void (async () => {
  await ensureHouse();
  server.listen(PORT, () => {
    console.log(`CLASHR server on :${PORT}`);
    console.log(CREDITS_DISCLAIMER);
  });
})();
