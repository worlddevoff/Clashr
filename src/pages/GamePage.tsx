import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from 'lucide-react';
import { Arena } from '../components/game/Arena';
import { GameHud } from '../components/game/GameHud';
import { ResultsScreen } from '../components/game/ResultsScreen';
import { TutorialOverlay } from '../components/game/TutorialOverlay';
import { useBombParty, useNetworkBombParty, bombResultToGame } from '../game/useBombParty';
import { useGameJuice } from '../game/useGameJuice';
import { TAUNTS } from '../game/BombPartyEngine';
import { getBombMap } from '../game/bombMaps';
import { useGameSetup, buildResult, type SessionSetup } from '../game/useGameSession';
import { useEconomy } from '../contexts/EconomyContext';
import { useAuth } from '../contexts/AuthContext';
import { useLeaderboard } from '../contexts/LeaderboardContext';
import { loadPartyRoster } from '../lib/party';
import { recordMatchHistory } from '../lib/matchHistory';
import { unlockAudio } from '../lib/audio';
import type { GameResult } from '../types/domain';

const ARENA = { width: 900, height: 620 };

export function GamePage() {
  const { roomId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthed, user } = useAuth();
  const capacity = Math.max(2, Math.min(20, Number(params.get('cap')) || 5));
  const entry = Math.max(0, Number(params.get('entry')) || 50);
  const partyId = params.get('party')?.toUpperCase() ?? null;
  const roster = useMemo(
    () => (partyId ? loadPartyRoster(partyId) : null),
    [partyId],
  );

  const [nonce, setNonce] = useState(0);
  const setup = useGameSetup(capacity, entry, roster?.members ?? null, roster);
  const isHost = !partyId || !user || !roster ? true : roster.hostId === user.id;

  const replay = () => {
    // Party rematches still go through the lobby; keep the same stake/capacity.
    if (partyId) {
      const qs = new URLSearchParams();
      qs.set('cap', String(roster?.capacity ?? capacity));
      const host = roster?.hostId || params.get('host');
      if (host) qs.set('host', host);
      const vis = params.get('vis');
      if (vis) qs.set('vis', vis);
      const stake = roster?.entryLamports ?? params.get('stake');
      if (stake) qs.set('stake', String(stake));
      navigate(`/party/${partyId}?${qs.toString()}`);
      return;
    }
    setNonce((n) => n + 1);
  };

  if (!isAuthed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-950 px-4 text-center">
        <p className="font-display text-sm uppercase tracking-widest text-white/50">
          Connect your wallet to play — including free games
        </p>
        <button
          onClick={() => navigate('/play')}
          className="rounded-xl bg-neon-magenta px-5 py-3 font-display text-sm font-semibold uppercase tracking-wide text-white shadow-glow-magenta"
        >
          Connect wallet to play
        </button>
      </div>
    );
  }

  return (
    <GameInstance
      key={`${roomId}-${nonce}-${partyId ?? 'solo'}`}
      setup={setup}
      roomId={roomId ?? 'r5'}
      partyId={partyId}
      isHost={isHost}
      onReplay={replay}
    />
  );
}

function GameInstance({
  setup,
  partyId,
  isHost,
  onReplay,
}: {
  setup: SessionSetup;
  roomId: string;
  partyId: string | null;
  isHost: boolean;
  onReplay: () => void;
}) {
  const navigate = useNavigate();
  const { providers } = useEconomy();
  const { updateUser, user, refreshUser } = useAuth();
  const { recordMatch } = useLeaderboard();
  const [result, setResult] = useState<GameResult | null>(null);
  const [localMap] = useState(() => getBombMap(Math.floor(Math.random() * 1_000_000_000), ARENA.width, ARENA.height));
  const settledRef = useRef(false);
  const runLocal = !partyId;

  useEffect(() => {
    unlockAudio();
  }, []);

  const settle = useCallback(
    (
      res: GameResult,
      winnerId: string | null,
      participants?: Array<{
        id: string;
        username: string;
        avatar: string;
        color: string;
        isBot: boolean;
      }>,
    ) => {
      if (settledRef.current) return;
      settledRef.current = true;

      const roster =
        participants ??
        setup.seed.map((p) => ({
          id: p.id,
          username: p.username,
          avatar: p.avatar,
          color: p.color,
          isBot: !p.isHuman,
        }));

      recordMatch(roster, res.winnerId, res.prize);
      const youWon = !res.winnerIsBot && (winnerId === setup.humanId || res.winnerId === setup.humanId);
      if (youWon) {
        updateUser({
          wins: (user?.wins ?? 0) + 1,
          gamesPlayed: (user?.gamesPlayed ?? 0) + 1,
          streak: (user?.streak ?? 0) + 1,
          biggestWin: Math.max(user?.biggestWin ?? 0, res.prize),
          xp: (user?.xp ?? 0) + (setup.practiceMode ? 120 : 250),
        });
      } else {
        updateUser({
          gamesPlayed: (user?.gamesPlayed ?? 0) + 1,
          streak: 0,
          xp: (user?.xp ?? 0) + 80,
        });
      }
      setResult(res);
      if (partyId) void refreshUser();
      if (user?.walletAddress) {
        recordMatchHistory(user.walletAddress, {
          gameNumber: res.gameNumber,
          won: youWon,
          prize: youWon && !setup.practiceMode ? res.prize : setup.practiceMode ? 0 : -(setup.grossPool / Math.max(setup.humanCount, 1)),
          practice: setup.practiceMode,
          at: Date.now(),
        });
      }
    },
    [setup, updateUser, user, recordMatch, refreshUser, partyId],
  );

  const onFinish = useCallback(
    (winnerId: string | null, survivedSec: number) => {
      if (settledRef.current) return;
      const res = buildResult(
        setup,
        winnerId,
        survivedSec,
        providers.randomness.hashSeed,
        providers.randomness.serverSeed,
      );
      const participants = setup.seed.map((p) => ({
        id: p.id,
        username: p.username,
        avatar: p.avatar,
        color: p.color,
        isBot: !p.isHuman,
      }));
      const payout = async () => {
        settle(res, winnerId, participants);
      };
      void payout();
    },
    [setup, providers, settle],
  );

  const {
    snap: localSnap,
    moveTo: localMove,
    taunt: localTaunt,
  } = useBombParty({
    seed: setup.seed,
    arena: ARENA,
    humanId: setup.humanId,
    startTimer: 12,
    hazards: localMap.hazards,
    mapId: localMap.id,
    runLocal,
    onFinish: runLocal ? onFinish : undefined,
  });
  const net = useNetworkBombParty({
    enabled: !!partyId,
    partyId,
    isHost,
    expectedPlayers: setup.seed.filter((p) => p.isHuman).length,
  });

  useEffect(() => {
    if (!net.result || settledRef.current) return;
    settle(bombResultToGame(net.result), net.result.winnerId);
  }, [net.result, settle]);

  const snap = runLocal ? localSnap : net.snap;
  const moveTo = runLocal ? localMove : net.moveTo;
  const taunt = runLocal ? localTaunt : net.taunt;

  const youWon = result ? result.winnerId === setup.humanId : null;
  const juice = useGameJuice(snap, setup.humanId, youWon);
  const humanAlive = !!snap?.players.find((p) => p.id === setup.humanId)?.alive;
  const spectating = juice.spectating;

  const onArenaPointer = useCallback(
    (x: number, y: number) => {
      if (spectating || !humanAlive) return;
      moveTo(x, y);
    },
    [spectating, humanAlive, moveTo],
  );

  if (result) {
    return (
      <ResultsScreen
        result={result}
        youWon={!!youWon}
        onPlayAgain={onReplay}
        onHome={() => navigate('/play')}
      />
    );
  }

  if (partyId && !snap) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-950 text-center">
        <div className="font-display text-sm uppercase tracking-widest text-neon-cyan">
          {net.error || net.status || 'Connecting to match server…'}
        </div>
        <p className="text-xs text-white/40">Keep this tab open — the shared match is starting.</p>
      </div>
    );
  }

  return (
    <div
      className="relative flex min-h-screen w-full flex-col bg-ink-950"
      onPointerDown={() => unlockAudio()}
    >
      {/* Bomb urgency tint + edge pulse */}
      <AnimatePresence>
        {juice.holdingBomb && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0.2 + juice.intensity * 0.25, 0.38 + juice.intensity * 0.45, 0.2 + juice.intensity * 0.25],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: Math.max(0.28, 0.9 - juice.intensity * 0.55),
              repeat: Infinity,
            }}
            className="pointer-events-none fixed inset-0 z-30"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 35%, rgba(255,43,43,0.55) 100%)',
              mixBlendMode: 'soft-light',
            }}
          />
        )}
      </AnimatePresence>

      {/* Spectator banner — stay in match until it ends */}
      <AnimatePresence>
        {spectating && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4"
          >
            <div className="rounded-xl border border-neon-cyan/50 bg-ink-950/90 px-4 py-2 text-center backdrop-blur">
              <div className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-neon-cyan">
                Spectating
              </div>
              <p className="mt-0.5 text-[11px] text-white/45">
                You&apos;re out — watch the rest of the match
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Explosion flash */}
      <AnimatePresence>
        {juice.flash > 0 && (
          <motion.div
            key={juice.flash}
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="pointer-events-none fixed inset-0 z-40 bg-white"
          />
        )}
      </AnimatePresence>

      {/* HOT POTATO callout */}
      <AnimatePresence>
        {juice.hotCallout && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
            className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center"
          >
            <span className="rounded-xl border border-neon-magenta bg-ink-950/90 px-5 py-2 font-display text-lg font-bold uppercase tracking-[0.2em] text-neon-magenta text-glow-magenta shadow-glow-magenta">
              Hot potato!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-3 py-4 sm:px-6">
        <div className="relative">
          {snap && (
            <>
              <GameHud
                snap={snap}
                prizePool={setup.prizePool}
                gameNumber={setup.gameNumber}
                practiceMode={setup.practiceMode}
              />
              <Arena
                snap={snap}
                humanId={setup.humanId}
                arena={ARENA}
                onPointerMove={onArenaPointer}
              />
              {!spectating && <TutorialOverlay snap={snap} humanId={setup.humanId} />}
            </>
          )}

          {partyId && (
            <div className="absolute -top-8 left-2 font-display text-[10px] uppercase tracking-widest text-neon-cyan/70">
              Shared match · server-authoritative
            </div>
          )}

          <button
            onClick={() => navigate(partyId ? `/party/${partyId}` : '/play')}
            aria-label="Leave game"
            className="absolute -top-1 right-2 z-50 hidden items-center gap-1.5 rounded-lg border border-ink-600 bg-ink-950/80 px-2.5 py-1.5 font-display text-[10px] uppercase tracking-wide text-white/50 backdrop-blur transition-colors hover:text-white sm:inline-flex"
            style={{ top: '-2.75rem' }}
          >
            <XIcon className="h-3.5 w-3.5" /> Leave
          </button>
        </div>

        <div className="mt-4">
          <TauntBar onTaunt={taunt} disabled={!humanAlive || spectating} />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="font-display text-[10px] uppercase tracking-widest text-white/35">
            {spectating
              ? 'Spectating · results unlock when the match ends'
              : 'WASD / arrows or tap to move · ice is slippery · pass by bumping · 1-6 to taunt'}
          </div>
          <AnimatePresence mode="wait">
            {snap?.lastEliminated && (
              <motion.div
                key={snap.lastEliminated + snap.aliveCount}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                className="rounded-lg border border-neon-magenta/40 bg-ink-850 px-3 py-1.5 font-display text-[11px] uppercase tracking-wide text-neon-magenta"
              >
                💥 {snap.lastEliminated} eliminated
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => navigate(partyId ? `/party/${partyId}` : '/play')}
          className="mt-4 self-center rounded-lg border border-ink-600 bg-ink-850 px-4 py-2 font-display text-[11px] uppercase tracking-wide text-white/50 sm:hidden"
        >
          Leave game
        </button>
      </div>
    </div>
  );
}

function TauntBar({ onTaunt, disabled }: { onTaunt: (emoji: string) => void; disabled: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1.5">
      <span className="mr-1 hidden font-display text-[10px] uppercase tracking-widest text-white/30 sm:inline">
        Taunt
      </span>
      {TAUNTS.map((emoji, i) => (
        <motion.button
          key={emoji}
          type="button"
          disabled={disabled}
          onClick={() => {
            unlockAudio();
            onTaunt(emoji);
          }}
          whileTap={{ scale: 0.85 }}
          aria-label={`Taunt ${emoji}`}
          className="relative grid h-11 w-11 place-items-center rounded-xl border border-ink-600 bg-ink-850 text-xl transition-[transform,border-color,background-color] duration-150 ease-out hover:-translate-y-0.5 hover:border-neon-cyan/60 hover:bg-ink-800 disabled:pointer-events-none disabled:opacity-40 sm:h-12 sm:w-12"
        >
          {emoji}
          <span className="absolute -bottom-1 right-1 font-display text-[8px] tabular-nums text-white/25">
            {i + 1}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
