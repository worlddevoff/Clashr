import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import { WebSocketServer, type WebSocket } from 'ws';
import { prisma } from './db.ts';
import { challengeMessage, issueNonce, loginWithSignature, userFromToken } from './auth.ts';
import { ensureHouse, getBalance } from './ledger.ts';
import { attachUser, detachSocket, handleMessage } from './matchmaking.ts';
import { CREDITS_DISCLAIMER, TOWER_STARTING_CREDITS } from '../../shared/games.ts';
import { simulatePrizePool } from '../../shared/tower/prize.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, game: 'tower', disclaimer: CREDITS_DISCLAIMER });
});

app.get('/api/tower/economy', (_req, res) => {
  res.json({ ...simulatePrizePool(), starting: TOWER_STARTING_CREDITS, disclaimer: CREDITS_DISCLAIMER });
});

app.post('/api/auth/challenge', async (req, res) => {
  try {
    const address = String(req.body.address || '');
    if (address.length < 32) return res.status(400).json({ error: 'address required' });
    const nonce = await issueNonce(address);
    res.json({ nonce, message: challengeMessage(address, nonce) });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { address, nonce, signatureHex, username, avatar, color } = req.body;
    const out = await loginWithSignature({ address, nonce, signatureHex, username, avatar, color });
    const balance = await getBalance(out.userId);
    res.json({ ...out, balance, disclaimer: CREDITS_DISCLAIMER });
  } catch (e) {
    res.status(400).json({ error: String(e) });
  }
});

app.get('/api/me', async (req, res) => {
  const user = await userFromToken(bearer(req.headers.authorization));
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const balance = await getBalance(user.id);
  res.json({ user, balance, disclaimer: CREDITS_DISCLAIMER });
});

app.get('/api/tower/leaderboard', async (_req, res) => {
  const rows = await prisma.leaderboardRow.findMany({ orderBy: [{ wins: 'desc' }, { biggestWin: 'desc' }], take: 50 });
  res.json({ rows, disclaimer: CREDITS_DISCLAIMER });
});

app.get('/api/tower/history', async (req, res) => {
  const user = await userFromToken(bearer(req.headers.authorization));
  if (!user) return res.status(401).json({ error: 'unauthorized' });
  const rows = await prisma.matchParticipant.findMany({
    where: { userId: user.id },
    include: { match: { include: { moments: true } } },
    orderBy: { match: { startedAt: 'desc' } },
    take: 20,
  });
  res.json({ rows, disclaimer: CREDITS_DISCLAIMER });
});

app.get('/api/tower/moments', async (_req, res) => {
  const rows = await prisma.detectedMoment.findMany({
    orderBy: { id: 'desc' },
    take: 24,
  });
  res.json({ rows });
});

app.get('/api/tower/match/:id', async (req, res) => {
  const match = await prisma.match.findUnique({
    where: { id: req.params.id },
    include: { participants: true, events: true, moments: true },
  });
  if (!match) return res.status(404).json({ error: 'not found' });
  res.json({ match, disclaimer: CREDITS_DISCLAIMER });
});

function bearer(h?: string): string | undefined {
  if (!h) return undefined;
  return h.startsWith('Bearer ') ? h.slice(7) : h;
}

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

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
    console.log(`CLASHR Tower server on :${PORT}`);
    console.log(CREDITS_DISCLAIMER);
    void __dirname;
  });
})();
