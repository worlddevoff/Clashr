import { useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcwIcon, Share2Icon, CheckIcon, HomeIcon } from 'lucide-react';
import type { GameResult } from '../../types/domain';
import { ShareCard } from './ShareCard';
import { Button } from '../ui/Button';
import { formatSol } from '../../utils/format';

interface Props {
  result: GameResult;
  youWon: boolean;
  onPlayAgain: () => void;
  onHome: () => void;
}

function buildShareText(result: GameResult, youWon: boolean): string {
  const who = youWon
    ? 'I just won'
    : result.winnerIsBot
      ? `${result.winner} (bot) just won`
      : `@${result.winner} just won`;
  const prizeLine =
    result.practiceMode || result.prize <= 0
      ? 'Practice vs bots · no SOL prize'
      : `+${formatSol(result.prize)} (pot − fee)`;
  return [
    `${who} Bomb Party #${result.gameNumber} on Clashr 💣`,
    `Survived ${result.survivedSec.toFixed(1)}s · ${result.playerCount} players · ${prizeLine}`,
    'Play at Clashr',
  ].join('\n');
}

function openXPost(text: string, url: string): void {
  const intent = new URL('https://x.com/intent/tweet');
  intent.searchParams.set('text', text);
  intent.searchParams.set('url', url);
  window.open(intent.toString(), '_blank', 'noopener,noreferrer');
}

export function ResultsScreen({ result, youWon, onPlayAgain, onHome }: Props) {
  const [shared, setShared] = useState(false);

  const shareMoment = () => {
    const text = buildShareText(result, youWon);
    const url = typeof window !== 'undefined' ? `${window.location.origin}/` : '';
    openXPost(text, url);
    setShared(true);
    window.setTimeout(() => setShared(false), 1800);
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4 py-10">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
        className="w-full"
      >
        <ShareCard result={result} youWon={youWon} />
      </motion.div>

      <div className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1" onClick={onPlayAgain}>
          <RotateCcwIcon className="h-5 w-5" /> Play again
        </Button>
        <Button size="lg" variant="secondary" className="flex-1" onClick={shareMoment}>
          {shared ? <CheckIcon className="h-5 w-5 text-neon-lime" /> : <Share2Icon className="h-5 w-5" />}
          {shared ? 'Opened X' : 'Share moment'}
        </Button>
      </div>
      <button
        onClick={onHome}
        className="inline-flex items-center gap-2 font-display text-xs uppercase tracking-wide text-white/40 transition-colors hover:text-white"
      >
        <HomeIcon className="h-4 w-4" /> Back to Clashr
      </button>
    </div>
  );
}
