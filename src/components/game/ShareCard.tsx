import type { GameResult } from '../../types/domain';
import { formatSol } from '../../utils/format';
import { Logo } from '../ui/Logo';

export function ShareCard({ result, youWon }: { result: GameResult; youWon: boolean }) {
  const practice = !!result.practiceMode || result.prize <= 0;
  const prizeText = formatSol(result.prize);
  const grossText = formatSol(result.grossPool ?? result.prize);
  const feeText = formatSol(result.platformFee ?? 0);

  return (
    <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-ink-600 bg-ink-900 p-6 shadow-panel">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: `radial-gradient(circle at 50% 0%, ${result.winnerColor}33, transparent 60%)` }}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <Logo compact />
          <span className="font-display text-[10px] uppercase tracking-widest text-white/40">
            Bomb Party #{result.gameNumber}
          </span>
        </div>

        <div className="mt-6 text-center">
          <div className="font-display text-xs uppercase tracking-[0.3em] text-neon-amber">
            {youWon ? 'You Won' : result.winnerIsBot ? 'Bot Won' : 'Winner'}
          </div>
          <div
            className="mx-auto mt-3 grid h-20 w-20 place-items-center rounded-3xl text-4xl"
            style={{ border: `3px solid ${result.winnerColor}`, boxShadow: `0 0 30px ${result.winnerColor}` }}
          >
            {result.winnerAvatar}
          </div>
          <div
            className="mt-3 font-display text-3xl font-bold uppercase tracking-tight"
            style={{ color: result.winnerColor, textShadow: `0 0 18px ${result.winnerColor}88` }}
          >
            {result.winnerIsBot ? result.winner : `@${result.winner}`}
          </div>
          {result.winnerIsBot && (
            <div className="mt-1 font-display text-[10px] uppercase tracking-widest text-neon-amber">
              AI opponent
            </div>
          )}

          {practice ? (
            <div className="mt-2 font-display text-sm uppercase tracking-wide text-white/45">
              Practice · no SOL prize
            </div>
          ) : youWon ? (
            <div className="mt-2 font-display text-2xl font-bold text-neon-lime text-glow-lime">
              +{prizeText}
            </div>
          ) : result.winnerIsBot ? (
            <div className="mt-2 font-display text-sm text-white/40">Pot stays with the house</div>
          ) : (
            <div className="mt-2 font-display text-2xl font-bold text-neon-lime text-glow-lime">
              +{prizeText}
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Fact label="Survived" value={`${result.survivedSec.toFixed(1)}s`} />
          <Fact label="Players" value={String(result.playerCount)} />
        </div>

        {!practice && (
          <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5">
            <div className="flex items-center justify-between text-[11px] text-white/45">
              <span>Gross pot</span>
              <span className="font-display tabular-nums text-white/70">
                {grossText}
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-white/45">
              <span>Clashr fee</span>
              <span className="font-display tabular-nums text-neon-amber">
                −{feeText}
              </span>
            </div>
            <div className="mt-1.5 flex items-center justify-between border-t border-ink-700 pt-1.5 text-[11px]">
              <span className="font-display uppercase tracking-wide text-neon-lime">
                {youWon ? 'You received' : 'Winner takes'}
              </span>
              <span className="font-display font-bold tabular-nums text-neon-lime">
                {prizeText}
              </span>
            </div>
          </div>
        )}
        {practice && (
          <div className="mt-3 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-center text-[11px] text-white/40">
            Solo vs bots is practice. Real pots need 2+ wallets staking SOL.
          </div>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 text-center">
      <div className="text-[9px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="mt-0.5 font-display text-lg font-bold text-white tabular-nums">{value}</div>
    </div>
  );
}
