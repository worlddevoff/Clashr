import { motion } from 'framer-motion';
import type { ArenaPlayer } from '../../types/game';

interface Props {
  player: ArenaPlayer;
  bombTimeLeft: number | null;
  intensity: number;
  isYou: boolean;
}

// A single arcade character. Position is absolute within the arena. The bomb
// countdown floats above the current holder and reddens as time runs out.
export function Character({ player, bombTimeLeft, intensity, isYou }: Props) {
  if (!player.alive) {
    const name = isYou
      ? 'You'
      : player.isHuman
        ? player.username
        : player.username.replace(/^Bot\s+/i, '');
    return (
      <motion.div
        className="pointer-events-none absolute select-none"
        style={{ left: player.pos.x, top: player.pos.y, zIndex: 2 }}
        initial={{ scale: 0.4, y: -18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      >
        <div className="absolute left-0 top-0 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
          <div
            className="text-[2.35rem] leading-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.65)]"
            style={{ filter: isYou ? `drop-shadow(0 0 10px ${player.color}88)` : undefined }}
            aria-hidden
          >
            🪦
          </div>
          <div
            className="mt-0.5 max-w-[4.5rem] truncate rounded-md border border-white/10 bg-ink-950/80 px-1.5 py-0.5 text-center font-display text-[8px] uppercase tracking-widest"
            style={{ color: isYou ? player.color : 'rgba(255,255,255,0.45)' }}
          >
            {name}
          </div>
          <div className="mt-0.5 font-display text-[7px] uppercase tracking-[0.2em] text-white/30">
            R.I.P.
          </div>
        </div>
      </motion.div>
    );
  }

  const danger = bombTimeLeft != null && bombTimeLeft < 3;
  const timerColor = bombTimeLeft == null ? '#fff' : bombTimeLeft < 1.5 ? '#ff2ea8' : bombTimeLeft < 4 ? '#ffb020' : '#b2ff59';

  return (
    <motion.div
      className="pointer-events-none absolute select-none"
      style={{ left: player.pos.x, top: player.pos.y, zIndex: player.hasBomb ? 30 : 10 }}
      animate={player.hasBomb && danger ? { rotate: [-4, 4, -4] } : { rotate: 0 }}
      transition={{ duration: 0.16, repeat: player.hasBomb && danger ? Infinity : 0 }}
    >
      {/* reaction / taunt bubble */}
      {player.reaction && (
        <motion.div
          key={player.reaction + player.reactionUntil}
          initial={{ scale: 0, y: 4, opacity: 0 }}
          animate={{ scale: [0, 1.25, 1], y: [-4, -10, -8], opacity: 1 }}
          transition={{ duration: 0.28, ease: [0.23, 1, 0.32, 1] }}
          className="absolute -right-5 -top-7 rounded-full border border-white/15 bg-ink-950/85 px-1.5 py-0.5 text-xl drop-shadow"
        >
          {player.reaction}
        </motion.div>
      )}

      {/* fuse countdown floats above the carrier; the bomb itself is held below */}
      {player.hasBomb && bombTimeLeft != null && (
        <motion.div
          className="absolute -top-12 left-0 -translate-x-1/2 rounded-lg px-2 py-0.5 font-display text-lg font-bold tabular-nums"
          style={{ color: timerColor, textShadow: `0 0 12px ${timerColor}` }}
          animate={{ scale: danger ? [1, 1.12, 1] : 1 }}
          transition={{ duration: 0.3, repeat: danger ? Infinity : 0 }}
        >
          {bombTimeLeft.toFixed(1)}
        </motion.div>
      )}

      {/* Body is centered on engine pos so collision matches the sprite, not the nameplate. */}
      <div className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2">
        {isYou && (
          <span
            className="absolute inset-0 rounded-2xl animate-pulse-ring"
            style={{ boxShadow: `0 0 0 2px ${player.color}` }}
          />
        )}
        <div
          className="grid h-12 w-12 place-items-center rounded-2xl text-2xl transition-transform"
          style={{
            backgroundColor: '#0b0b15',
            border: `2px solid ${player.color}`,
            boxShadow: player.hasBomb ? `0 0 24px #ff5a2e, 0 0 8px ${player.color}` : `0 0 12px ${player.color}66`,
          }}
        >
          {player.avatar}
        </div>
        {/* Held bomb sits on the character so the carrier reads at a glance,
            even when the floating timer is hidden. */}
        {player.hasBomb && (
          <motion.span
            className="absolute -bottom-2 -right-2.5 text-xl leading-none"
            animate={{ scale: [1, 1 + intensity * 0.35 + 0.08, 1], rotate: danger ? [-10, 10, -10] : 0 }}
            transition={{ duration: Math.max(0.16, 0.5 - intensity * 0.3), repeat: Infinity }}
            style={{ filter: `drop-shadow(0 0 ${5 + intensity * 14}px #ff5a2e)` }}
            aria-hidden
          >
            💣
          </motion.span>
        )}
      </div>
      <div
        className="absolute left-0 top-6 mt-1 -translate-x-1/2 truncate text-center font-display text-[9px] uppercase tracking-wide"
        style={{ color: isYou ? player.color : 'rgba(255,255,255,0.5)', maxWidth: 72 }}
      >
        {isYou ? 'You' : player.isHuman ? player.username : player.username.replace(/^Bot\s+/i, '')}
      </div>
      {!player.isHuman && (
        <div className="absolute left-0 top-[2.65rem] -translate-x-1/2 text-center font-display text-[8px] uppercase tracking-widest text-neon-amber/80">
          Bot
        </div>
      )}
    </motion.div>
  );
}
