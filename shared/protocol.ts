import type { TowerInput, TowerMatchResult, TowerSnapshot } from './tower/types';

export type ClientMsg =
  | { type: 'auth'; token: string }
  | { type: 'queue' }
  | { type: 'leave_queue' }
  | { type: 'party_create' }
  | { type: 'party_join'; code: string }
  | { type: 'party_leave' }
  | { type: 'party_start' }
  | { type: 'input'; matchId: string; input: TowerInput }
  | { type: 'leave_match'; matchId: string }
  | { type: 'ping'; t: number };

export type ServerMsg =
  | { type: 'hello'; ok: true }
  | { type: 'error'; message: string }
  | { type: 'queued'; position: number; players: number }
  | { type: 'party'; code: string; members: Array<{ id: string; username: string; avatar: string; color: string }> }
  | { type: 'match_start'; matchId: string; seed: number; you: string }
  | { type: 'snapshot'; matchId: string; snap: TowerSnapshot }
  | { type: 'match_end'; result: TowerMatchResult }
  | { type: 'pong'; t: number };
