import type {
  FeaturedGame,
  LiveGame,
  LobbyRoom,
  Moment,
} from '../types/domain';

export const FEATURED_GAMES: FeaturedGame[] = [
  {
    slug: 'tower',
    name: 'Tower',
    tagline: 'Climb. Shove. Survive.',
    description:
      'Ten players race up a collapsing neon tower. Shove rivals off the ledges and be first to the WIN pad to take the whole pot.',
    status: 'playable',
    accent: 'cyan',
    emoji: '🗼',
    players: '2–10 players',
    stakeRange: '0.05 – 5 SOL',
  },
  {
    slug: 'bomb-party',
    name: 'Bomb Party',
    tagline: 'Pass it before it blows.',
    description:
      'A fuse, a circle, and no good options. Hold the bomb when it goes off and your stake goes with it.',
    status: 'playable',
    accent: 'magenta',
    emoji: '💣',
    players: '2–20 players',
    stakeRange: '0.01 – 2 SOL',
  },
  {
    slug: 'floor-is-cash',
    name: 'Floor Is Cash',
    tagline: "Don't touch the floor.",
    description: 'Tiles drop out from under you every round. Last one standing clears the table.',
    status: 'coming-soon',
    accent: 'lime',
    emoji: '💵',
    players: '4–12 players',
  },
  {
    slug: 'claw-chaos',
    name: 'Claw Chaos',
    tagline: 'Grab everything.',
    description: 'Compete for the same prize pile with one unreliable claw.',
    status: 'coming-soon',
    accent: 'amber',
    emoji: '🦾',
    players: '2–6 players',
  },
  {
    slug: 'rocket-run',
    name: 'Rocket Run',
    tagline: 'Boost or bust.',
    description: 'Ride the multiplier as long as your nerve holds. Cash out before the rocket dies.',
    status: 'coming-soon',
    accent: 'violet',
    emoji: '🚀',
    players: '1–50 players',
  },
];

export const LIVE_GAMES: LiveGame[] = [];

export const MOMENTS: Moment[] = [];

export const LOBBY_ROOMS: LobbyRoom[] = [
  { id: 'r2', capacity: 2, entry: 50, waiting: 0, estDurationSec: 45 },
  { id: 'r5', capacity: 5, entry: 50, waiting: 0, estDurationSec: 75 },
  { id: 'r10', capacity: 10, entry: 50, waiting: 0, estDurationSec: 110 },
  { id: 'r20', capacity: 20, entry: 50, waiting: 0, estDurationSec: 150 },
];

export const ACHIEVEMENTS = [
  { id: 'a1', label: 'First Blast', description: 'Play your first game', icon: '💥', unlocked: true },
  { id: 'a2', label: 'Hot Potato', description: 'Pass the bomb 10 times in one game', icon: '🥔', unlocked: true },
  { id: 'a3', label: 'Buzzer Beater', description: 'Survive with under 1s left', icon: '⏱️', unlocked: true },
  { id: 'a4', label: 'Untouchable', description: 'Win 3 games in a row', icon: '🔥', unlocked: false },
  { id: 'a5', label: 'Arena Legend', description: 'Reach level 20', icon: '👑', unlocked: false },
  { id: 'a6', label: 'Party Animal', description: 'Play 100 games', icon: '🎉', unlocked: false },
];
