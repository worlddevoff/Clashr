import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { EngineSnapshot } from '../../types/game';
import { Button } from '../ui/Button';

const STORAGE_KEY = 'arcade.tutorial.v1';

export function tutorialDone(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

export function markTutorialDone(): void {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

type Step = 'move' | 'pass' | 'zone' | null;

export function TutorialOverlay({
  snap,
  humanId,
}: {
  snap: EngineSnapshot | null;
  humanId: string;
}) {
  const [enabled] = useState(() => !tutorialDone());
  const [step, setStep] = useState<Step>(enabled ? 'move' : null);
  const [dismissed, setDismissed] = useState(!enabled);

  useEffect(() => {
    if (!enabled || dismissed || !snap) return;

    if (step === 'move' && snap.status === 'live') {
      const me = snap.players.find((p) => p.id === humanId);
      if (me && (Math.abs(me.vel.x) + Math.abs(me.vel.y) > 0.2 || me.hasBomb)) {
        window.setTimeout(() => setStep('pass'), 600);
      }
    }

    if (step === 'pass') {
      const me = snap.players.find((p) => p.id === humanId);
      if (me?.hasBomb) {
        /* keep pass tip while holding */
      } else if (snap.bomb && snap.bomb.passCount > 0) {
        setStep(snap.safeZone.closing ? 'zone' : 'pass');
      }
      if (snap.safeZone.closing) setStep('zone');
    }

    if (step === 'zone' && snap.safeZone.closing) {
      window.setTimeout(() => {
        markTutorialDone();
        setDismissed(true);
        setStep(null);
      }, 3500);
    }

    if (snap.status === 'finished') {
      markTutorialDone();
      setDismissed(true);
      setStep(null);
    }
  }, [snap, humanId, step, enabled, dismissed]);

  const skip = () => {
    markTutorialDone();
    setDismissed(true);
    setStep(null);
  };

  const copy =
    step === 'move'
      ? 'Move with WASD / arrows — or tap the arena'
      : step === 'pass'
        ? 'Bump another player to pass the bomb!'
        : step === 'zone'
          ? 'Stay inside the glowing ring — outside = out'
          : null;

  return (
    <AnimatePresence>
      {copy && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
          className="pointer-events-none absolute inset-x-0 bottom-4 z-[60] flex justify-center px-4"
        >
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border border-neon-cyan/40 bg-ink-950/90 px-4 py-3 shadow-glow-cyan backdrop-blur">
            <p className="font-display text-xs uppercase tracking-wide text-neon-cyan sm:text-sm">
              {copy}
            </p>
            <Button size="sm" variant="ghost" onClick={skip} className="shrink-0">
              Skip
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
