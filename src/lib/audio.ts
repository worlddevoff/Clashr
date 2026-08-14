/** Lightweight Web Audio SFX — no asset files required. */

type Sfx =
  | 'countdown'
  | 'go'
  | 'tick'
  | 'pass'
  | 'explode'
  | 'zone'
  | 'win'
  | 'lose'
  | 'hot'
  | 'heartbeat';

let ctx: AudioContext | null = null;
let muted = false;
let unlocked = false;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    ctx = new Ctx();
  }
  return ctx;
}

/** Call from a user gesture so browsers allow audio. */
export function unlockAudio(): void {
  const c = ac();
  if (!c) return;
  if (c.state === 'suspended') void c.resume();
  unlocked = true;
}

export function setMuted(next: boolean): void {
  muted = next;
}

export function isMuted(): boolean {
  return muted;
}

function tone(
  freq: number,
  duration: number,
  type: OscillatorType = 'square',
  gain = 0.08,
  when = 0,
): void {
  const c = ac();
  if (!c || muted || !unlocked) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noiseBurst(duration: number, gain = 0.12): void {
  const c = ac();
  if (!c || muted || !unlocked) return;
  const len = Math.floor(c.sampleRate * duration);
  const buffer = c.createBuffer(1, len, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(g);
  g.connect(c.destination);
  src.start();
}

export function playSfx(name: Sfx): void {
  unlockAudio();
  switch (name) {
    case 'countdown':
      tone(440, 0.12, 'square', 0.07);
      break;
    case 'go':
      tone(660, 0.08, 'square', 0.09);
      tone(880, 0.12, 'square', 0.08, 0.08);
      break;
    case 'tick':
      tone(920, 0.05, 'square', 0.06);
      break;
    case 'pass':
      tone(320, 0.06, 'sawtooth', 0.05);
      tone(520, 0.08, 'sawtooth', 0.04, 0.05);
      break;
    case 'explode':
      noiseBurst(0.35, 0.18);
      tone(90, 0.28, 'sawtooth', 0.1);
      break;
    case 'zone':
      tone(180, 0.2, 'triangle', 0.05);
      tone(140, 0.25, 'triangle', 0.04, 0.1);
      break;
    case 'win':
      tone(523, 0.1, 'square', 0.07);
      tone(659, 0.1, 'square', 0.07, 0.1);
      tone(784, 0.18, 'square', 0.08, 0.2);
      break;
    case 'lose':
      tone(300, 0.15, 'triangle', 0.06);
      tone(220, 0.22, 'triangle', 0.05, 0.12);
      break;
    case 'hot':
      tone(700, 0.07, 'square', 0.05);
      tone(700, 0.07, 'square', 0.05, 0.12);
      break;
    case 'heartbeat':
      tone(70, 0.08, 'sine', 0.11);
      tone(55, 0.1, 'sine', 0.08, 0.12);
      break;
    default:
      break;
  }
}
