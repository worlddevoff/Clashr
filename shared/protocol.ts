import type { EngineSnapshot } from '../src/types/game';
import type { TowerInput, TowerMatchResult, TowerSnapshot } from './tower/types';

export type GameKind = 'tower' | 'bomb-party';

export type BombDir = 'up' | 'down' | 'left' | 'right';

export interface BombMatchResult {
  matchId: string;
  winnerId: string | null;
  winner: string;
  winnerAvatar: string;
  winnerColor: string;
  winnerIsBot: boolean;
  prize: number;
  prizeCurrency: 'SOL';
  grossPool: number;
  platformFee: number;
  practiceMode: boolean;
  survivedSec: number;
  playerCount: number;
  players: string[];
  timestamp: number;
}

export type ClientMsg =
  | { type: 'auth'; token: string }
  | { type: 'queue' }
  | { type: 'leave_queue' }
  | { type: 'party_create' }
  | { type: 'party_join'; code: string; asHost?: boolean; game?: GameKind }
  | { type: 'party_leave' }
  | { type: 'party_start'; code?: string; game?: GameKind }
  | { type: 'input'; matchId: string; input: TowerInput }
  | {
      type: 'bomb_input';
      matchId: string;
      key?: { dir: BombDir; pressed: boolean };
      move?: { x: number; y: number };
      taunt?: string;
    }
  | { type: 'leave_match'; matchId: string }
  | { type: 'ping'; t: number };

export type ServerMsg =
  | { type: 'hello'; ok: true }
  | { type: 'error'; message: string }
  | { type: 'queued'; position: number; players: number }
  | { type: 'party'; code: string; members: Array<{ id: string; username: string; avatar: string; color: string }> }
  | { type: 'match_start'; matchId: string; seed: number; you: string; game?: GameKind }
  | { type: 'snapshot'; matchId: string; snap: TowerSnapshot }
  | { type: 'match_end'; result: TowerMatchResult }
  | { type: 'bomb_snapshot'; matchId: string; snap: EngineSnapshot }
  | { type: 'bomb_end'; result: BombMatchResult }
  | { type: 'pong'; t: number };
