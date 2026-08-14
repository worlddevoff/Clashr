import { CREDITS_DISCLAIMER } from '../../shared/games';
import { signArcadeMessage } from './wallet';

const TOKEN_KEY = 'clashr.tower.token';

export function apiUrl(path: string): string {
  return path.startsWith('/api') ? path : `/api${path}`;
}

export function getTowerToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTowerToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

async function parseJson(res: Response) {
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function loginTowerServer(opts: {
  address: string;
  username: string;
  avatar: string;
  color: string;
}): Promise<{ token: string; balance: number }> {
  const ch = await parseJson(
    await fetch(apiUrl('/auth/challenge'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: opts.address }),
    }),
  ) as { nonce: string; message: string };
  const signatureHex = await signArcadeMessage(ch.message);
  const out = await parseJson(
    await fetch(apiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: opts.address,
        nonce: ch.nonce,
        signatureHex,
        username: opts.username,
        avatar: opts.avatar,
        color: opts.color,
      }),
    }),
  ) as { token: string; balance: number };
  setTowerToken(out.token);
  return out;
}

export async function fetchTowerMe(): Promise<{ balance: number } | null> {
  const token = getTowerToken();
  if (!token) return null;
  const res = await fetch(apiUrl('/me'), { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return (await res.json()) as { balance: number };
}

export async function fetchTowerEconomy() {
  const res = await fetch(apiUrl('/tower/economy'));
  if (!res.ok) return null;
  return (await res.json()) as {
    entry: number;
    gross: number;
    platformFee: number;
    prize: number;
    disclaimer: string;
  };
}

export async function fetchTowerLeaderboard() {
  const res = await fetch(apiUrl('/tower/leaderboard'));
  if (!res.ok) return [];
  const data = (await res.json()) as {
    rows: Array<{
      userId: string;
      username: string;
      avatar: string;
      color: string;
      wins: number;
      gamesPlayed: number;
      biggestWin: number;
      streak: number;
    }>;
  };
  return data.rows;
}

export async function fetchTowerMoments() {
  const res = await fetch(apiUrl('/tower/moments'));
  if (!res.ok) return [];
  const data = (await res.json()) as {
    rows: Array<{
      id: string;
      headline: string;
      player: string;
      avatar: string;
      color: string;
      stat: string;
      kind: string;
      matchId: string;
    }>;
  };
  return data.rows;
}

export { CREDITS_DISCLAIMER };
