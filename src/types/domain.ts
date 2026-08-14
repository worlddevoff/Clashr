// Shared domain types for THE ARCADE.
// These are transport-agnostic so a real server can serialize the same shapes.

export type GameId = string;
export type PlayerId = string;

export type GameStatus = 'lobby' | 'countdown' | 'live' | 'finished';

export type FeaturedGameStatus = 'playable' | 'coming-soon';

/** Numeric amounts. Match pots are SOL. */
export type Credits = number;

export interface User {
  id: PlayerId;
  username: string;
  avatar: string; // emoji character used across the app
  color: string; // neon accent hex
  level: number;
  xp: number;
  xpToNext: number;
  gamesPlayed: number;
  wins: number;
  biggestWin: Credits;
  streak: number;
  /** Solana base58 address used as the account id. */
  walletAddress: string;
  walletConnected: boolean;
}

export interface Achievement {
  id: string;
  label: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export interface LiveGame {
  id: GameId;
  name: string;
  players: number;
  capacity: number;
  prizePool: Credits;
  status: 'filling' | 'starting' | 'live';
  countdown: number; // seconds
}

export interface FeaturedGame {
  slug: string;
  name: string;
  tagline: string;
  status: FeaturedGameStatus;
  accent: 'cyan' | 'magenta' | 'lime' | 'amber' | 'violet';
  emoji: string;
}

export interface LeaderboardEntry {
  rank: number;
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

export interface Moment {
  id: string;
  headline: string;
  gameRef: string;
  player: string;
  avatar: string;
  color: string;
  stat: string;
  timeAgo: string;
}

export interface LobbyRoom {
  id: string;
  capacity: number;
  entry: Credits;
  waiting: number;
  estDurationSec: number;
}

/** A completed-game fairness + result record. Placeholder fairness only —
 *  NOT provably fair until the cryptographic implementation is reviewed. */
export interface GameResult {
  gameId: GameId;
  gameNumber: number;
  winner: string;
  winnerId: string;
  winnerAvatar: string;
  winnerColor: string;
  winnerIsBot: boolean;
  /** Net payout to the winner (gross pool minus platform fee). 0 in practice/solo. */
  prize: Credits;
  prizeCurrency?: 'SOL';
  /** Total entry fees in the pot before fee. */
  grossPool: Credits;
  /** Arcade fee taken from the pot. */
  platformFee: Credits;
  /** Solo vs bots — no SOL prize. */
  practiceMode?: boolean;
  survivedSec: number;
  playerCount: number;
  serverSeedHash: string;
  timestamp: number;
  players: string[];
}
