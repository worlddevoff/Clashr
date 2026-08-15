import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  leaderboardHighlights,
  rankLeaderboard,
  recordMatchResult,
  type GameParticipantStat,
  type LeaderboardEntryView,
} from '../lib/leaderboard';
import { fetchTowerLeaderboard } from '../lib/towerApi';
import type { Credits } from '../types/domain';

interface LeaderboardValue {
  entries: LeaderboardEntryView[];
  highlights: ReturnType<typeof leaderboardHighlights>;
  recordMatch: (
    participants: GameParticipantStat[],
    winnerId: string,
    prize: Credits,
  ) => void;
  refresh: () => void;
}

const LeaderboardContext = createContext<LeaderboardValue | null>(null);

function mapRows(
  rows: Awaited<ReturnType<typeof fetchTowerLeaderboard>>,
): LeaderboardEntryView[] {
  return rankLeaderboard(
    rows.map((r) => ({
      id: r.userId,
      username: r.username,
      avatar: r.avatar,
      color: r.color,
      isBot: false,
      wins: r.wins,
      gamesPlayed: r.gamesPlayed,
      biggestWin: r.biggestWin,
      streak: r.streak,
    })),
  );
}

export function LeaderboardProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LeaderboardEntryView[]>([]);

  const refresh = useCallback(() => {
    void fetchTowerLeaderboard().then((rows) => setEntries(mapRows(rows)));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const recordMatch = useCallback(
    (participants: GameParticipantStat[], winnerId: string, prize: Credits) => {
      setEntries(recordMatchResult(participants, winnerId, prize));
      window.setTimeout(refresh, 400);
    },
    [refresh],
  );

  const highlights = useMemo(() => leaderboardHighlights(entries), [entries]);

  const value = useMemo(
    () => ({ entries, highlights, recordMatch, refresh }),
    [entries, highlights, recordMatch, refresh],
  );

  return (
    <LeaderboardContext.Provider value={value}>{children}</LeaderboardContext.Provider>
  );
}

export function useLeaderboard(): LeaderboardValue {
  const ctx = useContext(LeaderboardContext);
  if (!ctx) throw new Error('useLeaderboard must be used within LeaderboardProvider');
  return ctx;
}
