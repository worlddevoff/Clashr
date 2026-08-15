import { CREDITS_DISCLAIMER } from '../../shared/games';
import { apiJson, apiUrl } from './api';
import { getSessionToken, setSessionToken } from './session';
import { signArcadeMessage } from './wallet';
import type { User } from '../types/domain';
import type { RecentMatch } from './matchHistory';

export function getTowerToken(): string | null {
  return getSessionToken();
}

export function setTowerToken(token: string | null): void {
  setSessionToken(token);
}

export async function loginTowerServer(opts: {
  address: string;
  username: string;
  avatar: string;
  color: string;
}): Promise<{ token: string; balance: number; user?: User | null; isNew?: boolean }> {
  const ch = await apiJson<{ nonce: string; message: string }>('/api/auth/challenge', {
    method: 'POST',
    body: JSON.stringify({ address: opts.address }),
  });
  const signatureHex = await signArcadeMessage(ch.message);
  const out = await apiJson<{ token: string; balance: number; user?: User | null; isNew?: boolean }>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({
        address: opts.address,
        nonce: ch.nonce,
        signatureHex,
        username: opts.username,
        avatar: opts.avatar,
        color: opts.color,
      }),
    },
  );
  setSessionToken(out.token);
  return out;
}

export async function fetchTowerMe(): Promise<{ balance: number; user?: User | null } | null> {
  const token = getSessionToken();
  if (!token) return null;
  try {
    return await apiJson<{ balance: number; user?: User | null }>('/api/me');
  } catch {
    return null;
  }
}

export async function fetchTowerEconomy() {
  try {
    return await apiJson<{
      entry: number;
      gross: number;
      platformFee: number;
      prize: number;
      disclaimer: string;
    }>('/api/tower/economy');
  } catch {
    return null;
  }
}

export async function fetchTowerLeaderboard() {
  try {
    const data = await apiJson<{
      rows: Array<{
        id?: string;
        userId: string;
        username: string;
        avatar: string;
        color: string;
        wins: number;
        gamesPlayed: number;
        biggestWin: number;
        streak: number;
        rank?: number;
      }>;
    }>('/api/leaderboard');
    return data.rows;
  } catch {
    return [];
  }
}

export async function fetchMatchHistory(): Promise<RecentMatch[]> {
  try {
    const data = await apiJson<{ rows: RecentMatch[] }>('/api/history');
    return data.rows;
  } catch {
    return [];
  }
}

export async function fetchTowerMoments() {
  try {
    const data = await apiJson<{
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
    }>('/api/tower/moments');
    return data.rows;
  } catch {
    return [];
  }
}

export { CREDITS_DISCLAIMER, apiUrl };
