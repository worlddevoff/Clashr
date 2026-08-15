import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BombPartyEngine, TAUNTS, type BombPartySeedPlayer } from './BombPartyEngine';
import type { ClientMsg } from '../../shared/protocol';
import type { EngineSnapshot } from '../types/game';
import type { GameResult } from '../types/domain';
import type { BombMatchResult } from '../../shared/protocol';
import { connectTowerSocket } from '../lib/towerSocket';

interface Options {
  seed: BombPartySeedPlayer[];
  arena: { width: number; height: number };
  humanId: string;
  startTimer?: number;
  /** When false, engine is not created (guest renders remote snapshots). */
  runLocal?: boolean;
  onExplosion?: () => void;
  onFinish?: (winnerId: string | null, survivedSec: number, passCount: number) => void;
  onSnapshot?: (snap: EngineSnapshot) => void;
}

export function useBombParty({
  seed,
  arena,
  humanId,
  startTimer = 8,
  runLocal = true,
  onExplosion,
  onFinish,
  onSnapshot,
}: Options) {
  const engineRef = useRef<BombPartyEngine | null>(null);
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);
  const finishedRef = useRef(false);
  const onExplosionRef = useRef(onExplosion);
  const onFinishRef = useRef(onFinish);
  const onSnapshotRef = useRef(onSnapshot);
  onExplosionRef.current = onExplosion;
  onFinishRef.current = onFinish;
  onSnapshotRef.current = onSnapshot;

  if (runLocal && !engineRef.current) {
    engineRef.current = new BombPartyEngine(seed, {
      arena,
      startTimer,
      passTimeBonus: 0,
      humanId,
    });
  }

  useEffect(() => {
    if (!runLocal || !engineRef.current) return;
    const engine = engineRef.current;
    engine.setExplosionCallback(() => onExplosionRef.current?.());
    const unsub = engine.subscribe((s) => {
      setSnap(s);
      onSnapshotRef.current?.(s);
      if (s.status === 'finished' && !finishedRef.current) {
        finishedRef.current = true;
        const passCount = s.bomb?.passCount ?? 0;
        onFinishRef.current?.(s.winner?.id ?? null, engine.getElapsedSec(), passCount);
      }
    });
    engine.start();
    return () => {
      unsub();
      engine.stop();
    };
  }, [runLocal]);

  useEffect(() => {
    if (!runLocal) return;
    const map: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
    };
    const down = (e: KeyboardEvent) => {
      const dir = map[e.code];
      if (dir) {
        e.preventDefault();
        engineRef.current?.setKey(humanId, dir, true);
        return;
      }
      const m = /^Digit([1-6])$/.exec(e.code);
      if (m) {
        const idx = Number(m[1]) - 1;
        if (TAUNTS[idx]) engineRef.current?.taunt(humanId, TAUNTS[idx]);
      }
    };
    const up = (e: KeyboardEvent) => {
      const dir = map[e.code];
      if (dir) engineRef.current?.setKey(humanId, dir, false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, [runLocal, humanId]);

  const moveTo = useCallback(
    (x: number, y: number) => {
      engineRef.current?.setMoveTarget(humanId, { x, y });
    },
    [humanId],
  );

  const taunt = useCallback(
    (emoji: string) => {
      engineRef.current?.taunt(humanId, emoji);
    },
    [humanId],
  );

  const applyRemoteKey = useCallback(
    (playerId: string, dir: 'up' | 'down' | 'left' | 'right', pressed: boolean) => {
      engineRef.current?.setKey(playerId, dir, pressed);
    },
    [],
  );

  const applyRemoteMove = useCallback((playerId: string, x: number, y: number) => {
    engineRef.current?.setMoveTarget(playerId, { x, y });
  }, []);

  const applyRemoteTaunt = useCallback((playerId: string, emoji: string) => {
    engineRef.current?.taunt(playerId, emoji);
  }, []);

  const setRemoteSnap = useCallback((remote: EngineSnapshot) => {
    setSnap(remote);
  }, []);

  const engine = engineRef.current;

  return useMemo(
    () => ({
      snap,
      moveTo,
      taunt,
      engine,
      applyRemoteKey,
      applyRemoteMove,
      applyRemoteTaunt,
      setRemoteSnap,
    }),
    [snap, moveTo, taunt, engine, applyRemoteKey, applyRemoteMove, applyRemoteTaunt, setRemoteSnap],
  );
}

export function bombResultToGame(r: BombMatchResult): GameResult {
  return {
    gameId: r.matchId,
    gameNumber: 0,
    winner: r.winner,
    winnerId: r.winnerId ?? '',
    winnerAvatar: r.winnerAvatar,
    winnerColor: r.winnerColor,
    winnerIsBot: r.winnerIsBot,
    prize: r.prize,
    prizeCurrency: r.prizeCurrency,
    grossPool: r.grossPool,
    platformFee: r.platformFee,
    practiceMode: r.practiceMode,
    survivedSec: r.survivedSec,
    playerCount: r.playerCount,
    serverSeedHash: '',
    timestamp: r.timestamp,
    players: r.players,
  };
}

export function useNetworkBombParty(opts: {
  enabled: boolean;
  partyId: string | null;
  isHost: boolean;
  expectedPlayers: number;
}) {
  const { enabled, partyId, isHost, expectedPlayers } = opts;
  const [snap, setSnap] = useState<EngineSnapshot | null>(null);
  const [result, setResult] = useState<BombMatchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('idle');
  const sendRef = useRef<(msg: ClientMsg) => void>(() => undefined);
  const matchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !partyId) return;
    let started = false;
    const conn = connectTowerSocket((msg) => {
      if (msg.type === 'error') setError(msg.message);
      if (msg.type === 'hello') setStatus('party');
      if (msg.type === 'party' && isHost && !started) {
        if (msg.members.length >= Math.max(expectedPlayers, 1)) {
          started = true;
          conn.send({ type: 'party_start', code: partyId, game: 'bomb-party' });
        }
      }
      if (msg.type === 'match_start' && msg.game === 'bomb-party') {
        matchRef.current = msg.matchId;
        setStatus('live');
      }
      if (msg.type === 'bomb_snapshot') setSnap(msg.snap);
      if (msg.type === 'bomb_end') {
        setResult(msg.result);
        setStatus('finished');
      }
    });
    sendRef.current = conn.send;
    conn.send({ type: 'party_join', code: partyId, asHost: isHost, game: 'bomb-party' });
    setStatus('Joining party…');
    const map: Record<string, 'up' | 'down' | 'left' | 'right'> = {
      ArrowUp: 'up',
      KeyW: 'up',
      ArrowDown: 'down',
      KeyS: 'down',
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
    };
    const down = (e: KeyboardEvent) => {
      const dir = map[e.code];
      const id = matchRef.current;
      if (dir && id) {
        e.preventDefault();
        conn.send({ type: 'bomb_input', matchId: id, key: { dir, pressed: true } });
        return;
      }
      const m = /^Digit([1-6])$/.exec(e.code);
      if (m && id && TAUNTS[Number(m[1]) - 1]) {
        conn.send({ type: 'bomb_input', matchId: id, taunt: TAUNTS[Number(m[1]) - 1] });
      }
    };
    const up = (e: KeyboardEvent) => {
      const dir = map[e.code];
      const id = matchRef.current;
      if (dir && id) conn.send({ type: 'bomb_input', matchId: id, key: { dir, pressed: false } });
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const wait = window.setTimeout(() => {
      if (!started && isHost) {
        started = true;
        conn.send({ type: 'party_start', code: partyId, game: 'bomb-party' });
      }
    }, 4000);
    return () => {
      window.clearTimeout(wait);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      conn.send({ type: 'party_leave' });
      const id = matchRef.current;
      if (id) conn.send({ type: 'leave_match', matchId: id });
      conn.close();
    };
  }, [enabled, partyId, isHost, expectedPlayers]);

  const moveTo = useCallback((x: number, y: number) => {
    const id = matchRef.current;
    if (!id) return;
    sendRef.current({ type: 'bomb_input', matchId: id, move: { x, y } });
  }, []);

  const taunt = useCallback((emoji: string) => {
    const id = matchRef.current;
    if (!id) return;
    sendRef.current({ type: 'bomb_input', matchId: id, taunt: emoji });
  }, []);

  const sendKey = useCallback((dir: 'up' | 'down' | 'left' | 'right', pressed: boolean) => {
    const id = matchRef.current;
    if (!id) return;
    sendRef.current({ type: 'bomb_input', matchId: id, key: { dir, pressed } });
  }, []);

  return { snap, result, error, status, moveTo, taunt, sendKey };
}
