// ---------------------------------------------------------------------------
// FUTURE REAL-MONEY ARCHITECTURE — INTERFACES ONLY.
//
// These abstractions exist so a properly licensed / compliant real-money layer
// can be integrated later WITHOUT rewriting the application. The MVP ships only
// mock/virtual-credit implementations (see ./mock.ts). None of these interfaces
// touch real cryptocurrency, deposits, withdrawals, or gambling transactions.
// Do NOT wire real funds through these until a compliant provider is reviewed.
// ---------------------------------------------------------------------------
import type { Credits, GameId, PlayerId } from '../types/domain';

export interface WalletProvider {
  readonly kind: 'mock' | 'crypto' | 'custodial';
  isConnected(): boolean;
  /** Auth uses Solana wallet adapters; this reports connection / future deposit rails. */
  connect(): Promise<{ ok: boolean; message: string }>;
  disconnect(): Promise<void>;
  getBalance(playerId: PlayerId): Promise<Credits>;
}

export interface PaymentProvider {
  readonly kind: 'virtual' | 'stablecoin' | 'fiat';
  /** Grants demo credits in the MVP. A real impl would settle a deposit. */
  credit(playerId: PlayerId, amount: Credits, memo: string): Promise<Credits>;
  debit(playerId: PlayerId, amount: Credits, memo: string): Promise<Credits>;
}

export interface GameEntryProvider {
  /** Validates & collects the entry stake for a game. Server-authoritative. */
  enterGame(playerId: PlayerId, gameId: GameId, entry: Credits): Promise<{ ok: boolean; balance: Credits }>;
}

export interface PrizePoolProvider {
  /** Given entries and the disclosed platform fee, compute the pooled prize. */
  computePool(entry: Credits, playerCount: number, feeRate: number): {
    gross: Credits;
    platformFee: Credits;
    prizePool: Credits;
  };
}

export interface PayoutProvider {
  payout(playerId: PlayerId, gameId: GameId, amount: Credits): Promise<Credits>;
}

export interface RandomnessProvider {
  /** Placeholder fairness. NOT provably fair until reviewed. */
  serverSeed(): string;
  hashSeed(seed: string): string;
  pick<T>(items: T[]): T;
}

export interface PlayerVerificationProvider {
  /** Eligibility / KYC / geo gating would live here in a compliant build. */
  isEligible(playerId: PlayerId): Promise<{ eligible: boolean; reason?: string }>;
}

export interface ArcadeProviders {
  wallet: WalletProvider;
  payment: PaymentProvider;
  entry: GameEntryProvider;
  prizePool: PrizePoolProvider;
  payout: PayoutProvider;
  randomness: RandomnessProvider;
  verification: PlayerVerificationProvider;
}
