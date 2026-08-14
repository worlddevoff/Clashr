import { CREDITS_DISCLAIMER } from '../../../shared/games';
import type { TowerMatchResult } from '../../../shared/tower/types';
import { Button } from '../ui/Button';
import { TowerShareCard } from './TowerShareCard';
import { formatSol } from '../../utils/format';

export function TowerResults({
  result,
  youId,
  solPrize,
  onAgain,
  onHome,
}: {
  result: TowerMatchResult;
  youId: string;
  solPrize?: number | null;
  onAgain: () => void;
  onHome: () => void;
}) {
  const you = result.participants.find((p) => p.id === youId);
  const winner = result.participants[0];

  return (
    <div className="flex min-h-screen flex-col items-center bg-ink-950 px-4 py-10 text-white">
      <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-cyan">Tower Complete</div>
      <h1 className="mt-2 font-display text-4xl font-bold uppercase">
        {winner?.placement === 1 ? `🥇 ${result.winnerName}` : result.winnerName}
      </h1>
      {solPrize != null ? (
        <>
          <p className="mt-2 font-display text-2xl font-bold text-neon-lime">
            {formatSol(solPrize)} SOL POT
          </p>
          <p className="mt-1 text-xs uppercase tracking-widest text-white/40">
            On-chain escrow · 5% platform fee
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 font-display text-2xl font-bold text-neon-lime">+{result.prize} CREDITS</p>
          <p className="mt-1 max-w-md text-center text-[11px] uppercase tracking-widest text-white/35">
            {CREDITS_DISCLAIMER}
          </p>
          <p className="mt-1 text-xs text-white/40">
            Pool {result.gross} · simulated fee {result.platformFee} · prize {result.prize}
          </p>
        </>
      )}

      <div className="mt-8 w-full max-w-2xl overflow-hidden rounded-2xl border border-ink-600">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-900 font-display text-[10px] uppercase tracking-widest text-white/40">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Floors</th>
              <th className="px-3 py-2">Shoves</th>
              <th className="px-3 py-2">Saves</th>
              <th className="px-3 py-2">Time</th>
              <th className="px-3 py-2">Winnings</th>
            </tr>
          </thead>
          <tbody>
            {result.participants.map((p) => (
              <tr
                key={p.id}
                className={p.id === youId ? 'bg-neon-cyan/10' : 'odd:bg-ink-900/40'}
              >
                <td className="px-3 py-2 font-display">{p.placement}</td>
                <td className="px-3 py-2">
                  {p.avatar} {p.username}
                  {p.isBot ? ' · bot' : ''}
                </td>
                <td className="px-3 py-2">{p.floorsReached}</td>
                <td className="px-3 py-2">{p.shoves}</td>
                <td className="px-3 py-2">{p.fallsSurvived}</td>
                <td className="px-3 py-2">{p.time.toFixed(1)}s</td>
                <td className="px-3 py-2 text-neon-lime">
                  {solPrize != null
                    ? p.placement === 1
                      ? formatSol(solPrize)
                      : '—'
                    : p.creditsWon}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {you && (
        <p className="mt-3 text-sm text-white/50">
          You finished #{you.placement} · floor {you.floorsReached} · {you.shoves} shoves
        </p>
      )}

      <div className="mt-8 w-full max-w-2xl rounded-2xl border border-ink-600 bg-ink-900 p-4">
        <div className="font-display text-[10px] uppercase tracking-widest text-white/40">Replay timeline</div>
        <div className="mt-2 max-h-40 overflow-auto text-xs text-white/60">
          {result.timeline.slice(-40).map((e, i) => (
            <div key={`${e.t}-${i}`}>
              {e.t.toFixed(1)}s · {e.text || e.kind}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-2">
        {result.moments.map((m) => (
          <TowerShareCard key={m.id} moment={m} />
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button onClick={onAgain}>{solPrize != null ? 'Back to Tower' : 'Play again'}</Button>
        <Button variant="secondary" onClick={onHome}>
          Share moment
        </Button>
      </div>
    </div>
  );
}
