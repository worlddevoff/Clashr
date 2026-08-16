import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TowerCanvas } from '../components/tower/TowerCanvas';
import { TowerHud } from '../components/tower/TowerHud';
import { TowerResults } from '../components/tower/TowerResults';
import { useAuth } from '../contexts/AuthContext';
import { useLocalTower, useNetworkTower } from '../game/useTower';
import { TOWER_BOT_AVATARS, TOWER_BOT_COLORS, TOWER_BOT_NAMES } from '../../shared/tower/bots';
import type { TowerFighter } from '../../shared/tower/engine';
import { moveFromCamera, outwardLookYaw } from '../../shared/tower/camera';
import type { TowerInput, TowerPlayerSnap } from '../../shared/tower/types';
import { playSfx, unlockAudio } from '../lib/audio';
import { CREDITS_DISCLAIMER } from '../../shared/games';
import { loadPartyRoster } from '../lib/party';
import { computeEscrowPool } from '../lib/escrow';
import { useSolPots } from '../contexts/SolPotsContext';
import type { PartyGameRoster } from '../types/party';
import { INPUT_RATE_HZ } from '../../shared/tower/constants';

const LOOK_SENSITIVITY = 0.0028;
const KEY_TURN_SPEED = 3.4;
const MIN_PITCH = -0.08;
const MAX_PITCH = 1.05;
const CAM_DIST_MIN = 5.5;
const CAM_DIST_MAX = 14;
const CAM_DIST_DEFAULT = 8.2;

function fillWithBots(humans: TowerFighter[], capacity: number): TowerFighter[] {
  const size = Math.max(2, Math.min(10, Math.round(capacity) || 10));
  const list = [...humans];
  for (let i = 0; list.length < size; i++) {
    list.push({
      id: `bot-${i}-${humans.length}`,
      username: `Bot ${TOWER_BOT_NAMES[i % TOWER_BOT_NAMES.length]}`,
      avatar: TOWER_BOT_AVATARS[i % TOWER_BOT_AVATARS.length],
      color: TOWER_BOT_COLORS[i % TOWER_BOT_COLORS.length],
      isBot: true,
    });
  }
  return list.slice(0, size);
}

export function TowerGamePage() {
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const practice = params.get('practice') === '1';
  const partyId = params.get('party')?.toUpperCase() ?? null;
  const partyRoster = useMemo(() => (partyId ? loadPartyRoster(partyId) : null), [partyId]);
  const practiceCap = Math.max(2, Math.min(10, Number(params.get('cap')) || 10));
  const [nonce, setNonce] = useState(0);
  const practicePlayer = useMemo(() => {
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      avatar: user.avatar,
      color: user.color,
    };
  }, [user]);

  if (!isAuthed || !user || !practicePlayer) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 px-4 text-center text-white">
        <div>
          <p className="font-display text-sm uppercase tracking-widest text-white/50">
            Connect your wallet to play — including free games
          </p>
          <button
            onClick={() => navigate('/play/tower')}
            className="mt-4 rounded-xl bg-neon-cyan px-4 py-2 font-display"
          >
            Connect wallet to play
          </button>
        </div>
      </div>
    );
  }

  return (
    <TowerMatch
      key={`${practice}-${partyId ?? 'solo'}-${practiceCap}-${nonce}`}
      practice={practice}
      practiceCap={practiceCap}
      partyRoster={partyRoster?.gameSlug === 'tower' ? partyRoster : null}
      userId={practicePlayer.id}
      username={practicePlayer.username}
      avatar={practicePlayer.avatar}
      color={practicePlayer.color}
      onAgain={() => setNonce((n) => n + 1)}
      onHome={() => navigate('/play/tower')}
    />
  );
}

function TowerMatch({
  practice,
  practiceCap,
  partyRoster,
  userId,
  username,
  avatar,
  color,
  onAgain,
  onHome,
}: {
  practice: boolean;
  practiceCap: number;
  partyRoster: PartyGameRoster | null;
  userId: string;
  username: string;
  avatar: string;
  color: string;
  onAgain: () => void;
  onHome: () => void;
}) {
  const potsOn = useSolPots();
  const fighters = useMemo(
    () => fillWithBots([{ id: userId, username, avatar, color, isBot: false }], practiceCap),
    [userId, username, avatar, color, practiceCap],
  );
  const partyId = partyRoster?.partyId ?? null;
  const isPartyHost = !!partyRoster && partyRoster.hostId === userId;
  const local = useLocalTower(practice ? fighters : [], userId);
  const net = useNetworkTower({
    enabled: !practice,
    partyId,
    isHost: isPartyHost,
    expectedPlayers: partyRoster?.members.length ?? 0,
  });
  const snap = practice ? local.snap : net.snap;
  const result = practice ? local.result : net.result;

  const setInput = useCallback(
    (input: TowerInput) => {
      if (practice) local.setInput(input);
      else net.setInput(input);
    },
    [practice, local.setInput, net.setInput],
  );

  const you = snap?.players.find((p) => p.id === userId) ?? null;
  const eliminated = !!you && !you.alive;

  const [paused, setPaused] = useState(false);
  const [spectateId, setSpectateId] = useState<string | null>(null);
  const [pointerLocked, setPointerLocked] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  // Camera orientation lives here rather than being derived from the player's
  // facing: the old camera spun to match every turn, which made the controls
  // feel like they changed direction under you.
  const camYaw = useRef(0);
  const camPitch = useRef(0.52);
  const camDist = useRef(CAM_DIST_DEFAULT);
  const aimed = useRef(false);
  const keys = useRef({ ax: 0, az: 0, jump: false, jumpHeld: false, shove: false, dodge: false });
  const turn = useRef(0);
  const pressed = useRef(new Set<string>());
  const seq = useRef(1);
  const lastEvent = useRef(0);
  const facing = useRef(0);
  if (you && !aimed.current) {
    camYaw.current = outwardLookYaw(you.x, you.z);
    aimed.current = true;
  }

  const alivePlayers = useMemo(
    () => (snap ? snap.players.filter((p) => p.alive) : []),
    [snap],
  );

  // Once you are out, follow someone who is still climbing instead of staring
  // at your own body falling into the void.
  const focusPlayer: TowerPlayerSnap | null = useMemo(() => {
    if (!snap) return null;
    if (!eliminated) return you;
    const chosen = spectateId ? alivePlayers.find((p) => p.id === spectateId) : null;
    if (chosen) return chosen;
    return [...alivePlayers].sort((a, b) => a.rank - b.rank)[0] ?? you;
  }, [snap, eliminated, spectateId, alivePlayers, you]);

  const cycleSpectate = useCallback(
    (dir: number) => {
      if (!alivePlayers.length) return;
      const current = alivePlayers.findIndex((p) => p.id === focusPlayer?.id);
      const next = (current + dir + alivePlayers.length) % alivePlayers.length;
      setSpectateId(alivePlayers[next].id);
    },
    [alivePlayers, focusPlayer],
  );

  const leaveMatch = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    if (practice) local.forfeit();
    else net.leave();
    onHome();
  }, [practice, local.forfeit, net.leave, onHome]);

  useEffect(() => {
    unlockAudio();
  }, []);

  useEffect(() => {
    if (!snap?.events.length) return;
    for (const e of snap.events) {
      if (e.t <= lastEvent.current) continue;
      lastEvent.current = e.t;
      if (e.kind === 'shove' || e.kind === 'shove_ko' || e.kind === 'impact') playSfx('explode');
      if (e.kind === 'ledge_save') playSfx('hot');
      if (e.kind === 'win') playSfx('win');
      if (e.kind === 'final') playSfx('zone');
      if (e.kind === 'elim') playSfx('lose');
    }
  }, [snap]);

  // Mouse look. Click the arena to capture the cursor; right-drag works even
  // without a lock so you can still turn mid-match. Losing the lock no longer
  // pauses — that used to freeze you the first time Esc or a click-out fired.
  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    let dragging = false;

    const applyLook = (dx: number, dy: number) => {
      camYaw.current -= dx * LOOK_SENSITIVITY;
      camPitch.current = Math.min(
        MAX_PITCH,
        Math.max(MIN_PITCH, camPitch.current + dy * LOOK_SENSITIVITY),
      );
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement === el) applyLook(e.movementX, e.movementY);
      else if (dragging) applyLook(e.movementX, e.movementY);
    };
    const onDown = (e: MouseEvent) => {
      if (paused) return;
      const hit = e.target as HTMLElement | null;
      if (hit?.closest('button, a, input, textarea')) return;
      if (e.button === 2) {
        dragging = true;
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;
      if (document.pointerLockElement === el) {
        keys.current.shove = true;
        return;
      }
      void el.requestPointerLock();
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 2) dragging = false;
    };
    const onLockChange = () => {
      setPointerLocked(document.pointerLockElement === el);
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
    };
    const onWheel = (e: WheelEvent) => {
      if (paused) return;
      camDist.current = Math.min(
        CAM_DIST_MAX,
        Math.max(CAM_DIST_MIN, camDist.current + e.deltaY * 0.012),
      );
    };

    el.addEventListener('mousedown', onDown);
    el.addEventListener('contextmenu', onContext);
    el.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('contextmenu', onContext);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, [paused]);

  const pumpInput = useCallback(
    () => {
      const k = keys.current;
      const move = moveFromCamera(camYaw.current, k.ax, k.az);
      if (Math.hypot(move.x, move.z) > 0.05) facing.current = Math.atan2(move.x, move.z);

      setInput({
        seq: seq.current++,
        ax: move.x,
        az: move.z,
        jump: k.jump,
        jumpHeld: k.jumpHeld,
        shove: k.shove,
        dodge: k.dodge,
        yaw: facing.current,
      });
      k.shove = false;
      k.jump = false;
      k.dodge = false;
    },
    [setInput],
  );

  useEffect(() => {
    const readAxes = () => {
      const on = (...codes: string[]) => codes.some((code) => pressed.current.has(code));
      keys.current.ax = (on('KeyD', 'ArrowRight') ? 1 : 0) - (on('KeyA', 'ArrowLeft') ? 1 : 0);
      keys.current.az = (on('KeyW', 'ArrowUp') ? 1 : 0) - (on('KeyS', 'ArrowDown') ? 1 : 0);
      turn.current = (on('KeyQ') ? 1 : 0) - (on('KeyE') ? 1 : 0);
      keys.current.jumpHeld = on('Space');
    };

    const down = (e: KeyboardEvent) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
      if (e.code === 'Escape') {
        if (document.pointerLockElement) {
          document.exitPointerLock();
          setPaused(true);
        } else {
          setPaused((p) => !p);
        }
        return;
      }
      if (e.repeat) return;
      pressed.current.add(e.code);
      readAxes();
      if (paused) return;
      if (e.code === 'Space') keys.current.jump = true;
      if (e.code === 'KeyF' || e.code === 'KeyJ') keys.current.shove = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.current.dodge = true;
      if (eliminated && (e.code === 'BracketLeft' || e.code === 'Comma')) cycleSpectate(-1);
      if (eliminated && (e.code === 'BracketRight' || e.code === 'Period')) cycleSpectate(1);
    };
    const up = (e: KeyboardEvent) => {
      pressed.current.delete(e.code);
      readAxes();
    };
    const blur = () => {
      pressed.current.clear();
      readAxes();
    };

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [paused, eliminated, cycleSpectate]);

  // Keep camera rotation at display refresh rate while sending gameplay input
  // at the server's 30 Hz input rate. Edge actions stay latched until sent.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let lastInput = last - 1000 / INPUT_RATE_HZ;
    const loop = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!paused) {
        camYaw.current += turn.current * KEY_TURN_SPEED * dt;
        if (t - lastInput >= 1000 / INPUT_RATE_HZ) {
          lastInput = t;
          pumpInput();
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [pumpInput, paused]);

  useEffect(() => {
    if (paused && document.pointerLockElement) document.exitPointerLock();
  }, [paused]);

  if (result) {
    const solPrize =
      potsOn && partyRoster?.escrowPda && partyRoster.entryLamports
        ? computeEscrowPool(partyRoster.members.length, partyRoster.entryLamports).prizePool
        : null;
    return (
      <TowerResults
        result={result}
        youId={userId}
        solPrize={solPrize}
        onAgain={partyRoster ? onHome : onAgain}
        onHome={onHome}
      />
    );
  }

  return (
    <div
      ref={shellRef}
      className="relative h-screen w-full select-none overflow-hidden bg-ink-950"
      onPointerDown={() => unlockAudio()}
    >
      {snap ? (
        <>
          <TowerCanvas
            snap={snap}
            humanId={userId}
            focusId={focusPlayer?.id}
            yawRef={camYaw}
            pitchRef={camPitch}
            distRef={camDist}
          />
          <TowerHud
            snap={snap}
            humanId={userId}
            name={username}
            avatar={avatar}
            practice={practice}
            spectating={eliminated ? (focusPlayer ?? null) : null}
            onSpectatePrev={() => cycleSpectate(-1)}
            onSpectateNext={() => cycleSpectate(1)}
            onPause={() => setPaused(true)}
            onLeave={leaveMatch}
          />
        </>
      ) : (
        <div className="grid h-full place-items-center font-display text-neon-cyan">
          <div className="text-center">
            <div>
              {practice
                ? 'Spawning…'
                : partyRoster
                  ? net.error || net.status || 'Connecting party…'
                  : net.error || net.status || 'Connecting…'}
            </div>
            <button
              type="button"
              onClick={leaveMatch}
              className="mt-6 rounded-xl border border-white/20 px-4 py-2 text-xs uppercase tracking-widest text-white/70 hover:bg-white/10"
            >
              Back to lobby
            </button>
          </div>
        </div>
      )}

      {snap && !paused && !pointerLocked && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 z-20 mx-auto w-fit rounded-full border border-white/15 bg-ink-950/65 px-4 py-1.5 font-display text-[10px] uppercase tracking-widest text-white/55 backdrop-blur">
          Click arena to look · hold right mouse · scroll to zoom
        </div>
      )}

      {paused && (
        <PauseMenu
          onResume={() => {
            setPaused(false);
            window.setTimeout(() => shellRef.current?.requestPointerLock(), 0);
          }}
          onLeave={leaveMatch}
          practice={practice}
          eliminated={eliminated}
        />
      )}

      <MobileControls
        onMove={(ax, az) => {
          keys.current.ax = ax;
          keys.current.az = az;
        }}
        onLook={(dx) => {
          camYaw.current -= dx * 0.006;
        }}
        onJump={() => {
          keys.current.jump = true;
          keys.current.jumpHeld = true;
          window.setTimeout(() => {
            keys.current.jumpHeld = false;
          }, 220);
        }}
        onShove={() => {
          keys.current.shove = true;
        }}
      />
    </div>
  );
}

function PauseMenu({
  onResume,
  onLeave,
  practice,
  eliminated,
}: {
  onResume: () => void;
  onLeave: () => void;
  practice: boolean;
  eliminated: boolean;
}) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-ink-950/80 backdrop-blur">
      <div className="w-[min(92vw,26rem)] rounded-2xl border border-white/10 bg-ink-950/90 p-6 text-white">
        <h2 className="font-display text-2xl uppercase tracking-widest">Paused</h2>
        <p className="mt-1 text-xs uppercase tracking-widest text-white/40">
          {practice ? 'Practice run' : 'The match keeps running while you are here'}
        </p>

        <dl className="mt-5 space-y-1.5 text-sm text-white/70">
          <ControlRow keys="W A S D" action="Move (camera-relative)" />
          <ControlRow keys="Mouse" action="Look — click to capture, right-drag always" />
          <ControlRow keys="Q E" action="Nudge camera without the mouse" />
          <ControlRow keys="Scroll" action="Zoom" />
          <ControlRow keys="Space" action="Jump — hold for height" />
          <ControlRow keys="Click / F" action="Shove" />
          <ControlRow keys="Shift" action="Dash" />
          <ControlRow keys="Esc" action="Pause" />
        </dl>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onResume}
            className="flex-1 rounded-xl bg-neon-cyan px-4 py-2.5 font-display text-sm uppercase tracking-widest text-ink-950"
          >
            {eliminated ? 'Keep watching' : 'Resume'}
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="flex-1 rounded-xl border border-neon-magenta/50 px-4 py-2.5 font-display text-sm uppercase tracking-widest text-neon-magenta hover:bg-neon-magenta/10"
          >
            Leave match
          </button>
        </div>
        <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-white/25">
          {CREDITS_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}

function ControlRow({ keys, action }: { keys: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 font-display text-[11px] uppercase tracking-widest text-white/80">
        {keys}
      </dt>
      <dd className="text-right text-xs text-white/55">{action}</dd>
    </div>
  );
}

function MobileControls({
  onMove,
  onLook,
  onJump,
  onShove,
}: {
  onMove: (ax: number, az: number) => void;
  onLook: (dx: number) => void;
  onJump: () => void;
  onShove: () => void;
}) {
  const origin = useRef<{ x: number; y: number } | null>(null);
  const lookX = useRef<number | null>(null);

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 sm:hidden">
      {/* Right half of the screen drags the camera. */}
      <div
        className="absolute bottom-40 right-0 h-48 w-1/2"
        onTouchStart={(e) => {
          lookX.current = e.touches[0].clientX;
        }}
        onTouchMove={(e) => {
          if (lookX.current == null) return;
          const x = e.touches[0].clientX;
          onLook(x - lookX.current);
          lookX.current = x;
        }}
        onTouchEnd={() => {
          lookX.current = null;
        }}
      />
      <div className="flex items-end justify-between px-4 pb-4">
        <div
          className="h-32 w-32 rounded-full border border-white/20 bg-black/30"
          onTouchStart={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }}
          onTouchMove={(e) => {
            if (!origin.current) return;
            const t = e.touches[0];
            const dx = (t.clientX - origin.current.x) / 56;
            const dy = (t.clientY - origin.current.y) / 56;
            const mag = Math.hypot(dx, dy) || 1;
            const scale = mag > 1 ? 1 / mag : 1;
            onMove(dx * scale, -dy * scale);
          }}
          onTouchEnd={() => {
            origin.current = null;
            onMove(0, 0);
          }}
        />
        <div className="flex gap-3">
          <button
            type="button"
            className="h-16 w-16 rounded-full bg-white/15 font-display text-[10px] uppercase text-white"
            onTouchStart={onJump}
          >
            Jump
          </button>
          <button
            type="button"
            className="h-16 w-16 rounded-full bg-neon-magenta/80 font-display text-[10px] uppercase text-white"
            onTouchStart={onShove}
          >
            Shove
          </button>
        </div>
      </div>
    </div>
  );
}
