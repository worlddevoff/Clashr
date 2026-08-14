import type { Credits } from '../types/domain';

const STORAGE_KEY = 'arcade.leaderboard.v2';

export interface LeaderboardRecord {
  id: string;
  username: string;
  avatar: string;
  color: string;
  isBot: boolean;
  wins: number;
  gamesPlayed: number;
  biggestWin: Credits;
  streak: number;
}

export interface LeaderboardEntryView extends LeaderboardRecord {
  rank: number;
}

export interface GameParticipantStat {
  id: string;
  username: string;
  avatar: string;
  color: string;
  isBot: boolean;
}

function readAll(): LeaderboardRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LeaderboardRecord[];
  } catch {
    /* ignore */
  }
  return [];
}

function writeAll(rows: LeaderboardRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    /* ignore */
  }
}

export function loadLeaderboard(): LeaderboardEntryView[] {
  return rankLeaderboard(readAll().filter((r) => !r.isBot));
}

export function rankLeaderboard(rows: LeaderboardRecord[]): LeaderboardEntryView[] {
  const humans = rows.filter((r) => !r.isBot);
  const sorted = [...humans].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.biggestWin !== a.biggestWin) return b.biggestWin - a.biggestWin;
    return b.gamesPlayed - a.gamesPlayed;
  });
  return sorted.map((row, i) => ({ ...row, rank: i + 1 }));
}

/** Apply one finished match: winner gets the win, everyone gets a gamesPlayed tick.
 *  Bots are never recorded — leaderboard is wallets only. */
export function recordMatchResult(
  participants: GameParticipantStat[],
  winnerId: string,
  prize: Credits,
): LeaderboardEntryView[] {
  const map = new Map(readAll().filter((r) => !r.isBot).map((r) => [r.id, { ...r }]));

  for (const p of participants) {
    if (p.isBot) continue;

    const existing = map.get(p.id) ?? {
      id: p.id,
      username: p.username,
      avatar: p.avatar,
      color: p.color,
      isBot: false,
      wins: 0,
      gamesPlayed: 0,
      biggestWin: 0,
      streak: 0,
    };

    existing.username = p.username;
    existing.avatar = p.avatar;
    existing.color = p.color;
    existing.isBot = false;
    existing.gamesPlayed += 1;

    if (p.id === winnerId) {
      existing.wins += 1;
      existing.streak += 1;
      existing.biggestWin = Math.max(existing.biggestWin, prize);
    } else {
      existing.streak = 0;
    }

    map.set(p.id, existing);
  }

  const next = Array.from(map.values());
  writeAll(next);
  return rankLeaderboard(next);
}

export function leaderboardHighlights(rows: LeaderboardEntryView[]) {
  if (rows.length === 0) {
    return {
      biggestWin: null as LeaderboardEntryView | null,
      mostGames: null as LeaderboardEntryView | null,
      longestStreak: null as LeaderboardEntryView | null,
    };
  }
  const biggestWin = [...rows].sort((a, b) => b.biggestWin - a.biggestWin)[0];
  const mostGames = [...rows].sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0];
  const longestStreak = [...rows].sort((a, b) => b.streak - a.streak)[0];
  return { biggestWin, mostGames, longestStreak };
}
