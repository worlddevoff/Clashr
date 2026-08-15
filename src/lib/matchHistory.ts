import type { Credits } from '../types/domain';

const PREFIX = 'arcade.matchHistory.v2.';
const MAX = 20;

export interface RecentMatch {
  gameNumber: number;
  gameSlug?: string;
  won: boolean;
  prize: Credits;
  practice: boolean;
  at: number;
}

export function loadMatchHistory(wallet: string): RecentMatch[] {
  try {
    const raw = localStorage.getItem(PREFIX + wallet);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentMatch[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function recordMatchHistory(wallet: string, match: RecentMatch): void {
  const next = [match, ...loadMatchHistory(wallet)].slice(0, MAX);
  try {
    localStorage.setItem(PREFIX + wallet, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}
