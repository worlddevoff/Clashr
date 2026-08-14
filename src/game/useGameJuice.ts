import { useEffect, useRef, useState } from 'react';
import type { EngineSnapshot } from '../types/game';
import { playSfx, unlockAudio } from '../lib/audio';

/** Drives SFX + urgency flags from engine snapshots. */
export function useGameJuice(snap: EngineSnapshot | null, humanId: string, youWon?: boolean | null) {
  const prev = useRef<EngineSnapshot | null>(null);
  const [flash, setFlash] = useState(0);
  const [hotCallout, setHotCallout] = useState(false);
  const zoneAnnounced = useRef(false);
  const lastTick = useRef(0);
  const lastBeat = useRef(0);
  const finishedSound = useRef(false);

  useEffect(() => {
    unlockAudio();
  }, []);

  useEffect(() => {
    if (!snap) return;
    const p = prev.current;

    if (p && p.status === 'countdown' && snap.status === 'countdown' && snap.countdown !== p.countdown) {
      if (snap.countdown > 0) playSfx('countdown');
      else playSfx('go');
    }
    if (p?.status === 'countdown' && snap.status === 'live') {
      playSfx('go');
    }

    if (p && snap.bomb && p.bomb) {
      if (snap.bomb.passCount > p.bomb.passCount) {
        playSfx('pass');
        if (snap.bomb.holderId === humanId) {
          setHotCallout(true);
          playSfx('hot');
          window.setTimeout(() => setHotCallout(false), 900);
        }
      }
      const meHasBomb = snap.players.some((pl) => pl.id === humanId && pl.hasBomb && pl.alive);
      if (meHasBomb && snap.bomb.timeLeft < 3.2 && snap.bomb.timeLeft > 0) {
        const bucket = Math.floor(snap.bomb.timeLeft * 5);
        if (bucket !== lastTick.current) {
          lastTick.current = bucket;
          playSfx('tick');
        }
      }
      // Heartbeat while you hold the bomb — faster as intensity rises
      if (meHasBomb) {
        const interval = Math.max(280, 900 - snap.bomb.intensity * 620);
        if (snap.elapsedMs - lastBeat.current >= interval) {
          lastBeat.current = snap.elapsedMs;
          playSfx('heartbeat');
        }
      }
    }

    if (snap.safeZone.closing && !zoneAnnounced.current) {
      zoneAnnounced.current = true;
      playSfx('zone');
    }

    if (p && snap.lastEliminated && snap.lastEliminated !== p.lastEliminated) {
      playSfx('explode');
      setFlash((n) => n + 1);
    }

    if (snap.status === 'finished' && !finishedSound.current) {
      finishedSound.current = true;
      playSfx(youWon ? 'win' : 'lose');
    }

    prev.current = snap;
  }, [snap, humanId, youWon]);

  const holdingBomb =
    !!snap?.players.find((pl) => pl.id === humanId && pl.alive && pl.hasBomb);
  const intensity = snap?.bomb?.intensity ?? 0;
  const spectating =
    !!snap &&
    snap.status === 'live' &&
    !snap.players.find((pl) => pl.id === humanId)?.alive;

  return { flash, hotCallout, holdingBomb, intensity, spectating };
}
