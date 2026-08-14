import type { Credits, PlayerId, GameResult } from './domain';
import type { EngineSnapshot } from './game';
import type { GameSlug } from '../../shared/games';
import type { TowerInput, TowerMatchResult, TowerSnapshot } from '../../shared/tower/types';

export const ENTRY_FEE: Credits = 50;
export const ENTRY_PRESETS = [10, 25, 50, 100, 250] as const;
export const PARTY_CAPACITIES = [2, 5, 10, 20] as const;
export type PartyCapacity = (typeof PARTY_CAPACITIES)[number];

export function clampEntry(n: number, fallback = ENTRY_FEE): Credits {
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(10_000, Math.max(1, Math.round(n)));
}

export interface PartyMember {
  id: PlayerId;
  username: string;
  avatar: string;
  color: string;
  isHost: boolean;
  joinedAt: number;
}

export type PartyStatus = 'waiting' | 'starting' | 'live';
export type PartyVisibility = 'public' | 'private';

export interface Party {
  id: string;
  gameSlug: GameSlug;
  capacity: number;
  entry: Credits;
  hostId: PlayerId;
  createdAt: number;
  status: PartyStatus;
  visibility: PartyVisibility;
  members: PartyMember[];
  /** Set when host starts — clients navigate here. */
  gamePath?: string;
  escrowPda?: string;
  escrowDeposits?: string[];
  entryLamports?: number;
}

/** Snapshot shown on the Play lobby for open public parties. */
export interface PublicPartyListing {
  id: string;
  gameSlug: GameSlug;
  capacity: number;
  entry: Credits;
  entryLamports?: number;
  hostId: PlayerId;
  hostName: string;
  memberCount: number;
  createdAt: number;
}

export interface PartyGameRoster {
  partyId: string;
  gameSlug: GameSlug;
  hostId: string;
  capacity: number;
  entry: number;
  members: PartyMember[];
  escrowPda?: string;
  entryLamports?: number;
}

export type GameIntentMessage =
  | { type: 'game:key'; playerId: string; dir: 'up' | 'down' | 'left' | 'right'; pressed: boolean }
  | { type: 'game:move'; playerId: string; x: number; y: number }
  | { type: 'game:taunt'; playerId: string; emoji: string };

export type PartyWireMessage =
  | { type: 'hello'; member: PartyMember }
  | { type: 'sync'; party: Party }
  | { type: 'deposited'; memberId: PlayerId }
  | { type: 'unstaked'; memberId: PlayerId }
  | { type: 'leave'; memberId: PlayerId }
  | { type: 'start'; party: Party; gamePath: string; roster: PartyGameRoster }
  | { type: 'ping' }
  | { type: 'game:snapshot'; snap: EngineSnapshot }
  | { type: 'tower:input'; playerId: PlayerId; input: TowerInput }
  | { type: 'tower:leave'; playerId: PlayerId }
  | { type: 'tower:snapshot'; snap: TowerSnapshot }
  | { type: 'tower:result'; result: TowerMatchResult }
  | {
      type: 'game:result';
      result: GameResult;
      participants: Array<{
        id: string;
        username: string;
        avatar: string;
        color: string;
        isBot: boolean;
      }>;
    }
  | GameIntentMessage;
