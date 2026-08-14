import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BombPartyEngine, TAUNTS, type BombPartySeedPlayer } from './BombPartyEngine';
import type { EngineSnapshot } from '../types/game';

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
