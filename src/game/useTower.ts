import { useCallback, useEffect, useRef, useState } from 'react';
import { TowerEngine, type TowerFighter } from '../../shared/tower/engine';
import type { ClientMsg } from '../../shared/protocol';
import type { TowerInput, TowerMatchResult, TowerSnapshot } from '../../shared/tower/types';
import { connectTowerSocket } from '../lib/towerSocket';

export function useLocalTower(fighters: TowerFighter[], humanId: string) {
  const engineRef = useRef<TowerEngine | null>(null);
  const [snap, setSnap] = useState<TowerSnapshot | null>(null);
  const [result, setResult] = useState<TowerMatchResult | null>(null);

  useEffect(() => {
    if (!fighters.length) return;
    const engine = new TowerEngine({
      seed: Math.floor(Math.random() * 1e9),
      matchId: `practice-${Date.now()}`,
      fighters,
      practice: true,
    });
    engineRef.current = engine;
    let raf = 0;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(48, t - last);
      last = t;
      engine.step(dt);
      setSnap(engine.snapshot());
      if (engine.finished && engine.result) {
        setResult(engine.result);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fighters, humanId]);

  const setInput = useCallback(
    (input: TowerInput) => {
      engineRef.current?.setInput(humanId, input);
    },
    [humanId],
  );

  const setPlayerInput = useCallback((playerId: string, input: TowerInput) => {
    engineRef.current?.setInput(playerId, input);
  }, []);

  const forfeit = useCallback(
    (playerId?: string) => {
      engineRef.current?.forfeit(playerId ?? humanId);
    },
    [humanId],
  );

  return {
    snap,
    result,
    setInput,
    setPlayerInput,
    forfeit,
    matchId: engineRef.current?.matchId ?? '',
  };
}

export function useNetworkTower(enabled: boolean) {
  const [snap, setSnap] = useState<TowerSnapshot | null>(null);
  const [result, setResult] = useState<TowerMatchResult | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);
  const sendRef = useRef<(msg: ClientMsg) => void>(() => undefined);
  const matchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const conn = connectTowerSocket((msg) => {
      if (msg.type === 'hello') setStatus('online');
      if (msg.type === 'queued') setStatus(`queued ${msg.players}`);
      if (msg.type === 'error') setError(msg.message);
      if (msg.type === 'match_start') {
        matchRef.current = msg.matchId;
        setMatchId(msg.matchId);
        setStatus('live');
      }
      if (msg.type === 'snapshot') setSnap(msg.snap);
      if (msg.type === 'match_end') {
        setResult(msg.result);
        setStatus('finished');
      }
    });
    sendRef.current = conn.send;
    conn.send({ type: 'queue' });
    return () => conn.close();
  }, [enabled]);

  const setInput = useCallback((input: TowerInput) => {
    const id = matchRef.current;
    if (!id) return;
    sendRef.current({ type: 'input', matchId: id, input });
  }, []);

  const leave = useCallback(() => {
    const id = matchRef.current;
    if (id) sendRef.current({ type: 'leave_match', matchId: id });
    else sendRef.current({ type: 'leave_queue' });
  }, []);

  return { snap, result, setInput, leave, matchId, status, error };
}
