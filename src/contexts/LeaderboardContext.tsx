import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  loadLeaderboard,
  recordMatchResult,
  leaderboardHighlights,
  type GameParticipantStat,
  type LeaderboardEntryView,
} from '../lib/leaderboard';
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

export function LeaderboardProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<LeaderboardEntryView[]>(() =>
    typeof window !== 'undefined' ? loadLeaderboard() : [],
  );

  const refresh = useCallback(() => {
    setEntries(loadLeaderboard());
  }, []);

  const recordMatch = useCallback(
    (participants: GameParticipantStat[], winnerId: string, prize: Credits) => {
      setEntries(recordMatchResult(participants, winnerId, prize));
    },
    [],
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
