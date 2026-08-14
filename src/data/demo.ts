import type {
  FeaturedGame,
  LiveGame,
  LobbyRoom,
  Moment,
} from '../types/domain';

export const FEATURED_GAMES: FeaturedGame[] = [
  { slug: 'tower', name: 'Tower', tagline: 'Climb. Shove. Survive.', status: 'playable', accent: 'cyan', emoji: '🗼' },
  { slug: 'bomb-party', name: 'Bomb Party', tagline: 'Pass it before it blows.', status: 'playable', accent: 'magenta', emoji: '💣' },
  { slug: 'floor-is-cash', name: 'Floor Is Cash', tagline: "Don't touch the floor.", status: 'coming-soon', accent: 'lime', emoji: '💵' },
  { slug: 'claw-chaos', name: 'Claw Chaos', tagline: 'Grab everything.', status: 'coming-soon', accent: 'amber', emoji: '🦾' },
  { slug: 'rocket-run', name: 'Rocket Run', tagline: 'Boost or bust.', status: 'coming-soon', accent: 'violet', emoji: '🚀' },
];

export const LIVE_GAMES: LiveGame[] = [];

export const MOMENTS: Moment[] = [
  { id: 'm1', headline: 'Jake survived with 0.2 seconds left.', gameRef: 'Bomb Party #479', player: 'JakeTheSnake', avatar: '🐍', color: '#b2ff59', stat: '0.2s remaining', timeAgo: '2m ago' },
  { id: 'm2', headline: 'CryptoCat eliminated 7 players.', gameRef: 'Bomb Party #482', player: 'CryptoCat', avatar: '🐱', color: '#22e5ff', stat: '7 eliminations', timeAgo: '5m ago' },
  { id: 'm3', headline: 'Bomb Party #482 reached the final 2.', gameRef: 'Bomb Party #482', player: 'The Arena', avatar: '💣', color: '#ff2ea8', stat: 'Final 2', timeAgo: '6m ago' },
  { id: 'm4', headline: 'Boomzilla passed the bomb 31 times.', gameRef: 'Bomb Party #480', player: 'Boomzilla', avatar: '🦖', color: '#ffb020', stat: '31 passes', timeAgo: '11m ago' },
  { id: 'm5', headline: 'PixelPop won 3 games in a row.', gameRef: 'Bomb Party #478', player: 'PixelPop', avatar: '👾', color: '#a06bff', stat: '3 win streak', timeAgo: '18m ago' },
  { id: 'm6', headline: 'FizzBot detonated on the buzzer.', gameRef: 'Bomb Party #477', player: 'FizzBot', avatar: '🤖', color: '#ff8fd8', stat: 'Buzzer beater', timeAgo: '24m ago' },
];

export const LOBBY_ROOMS: LobbyRoom[] = [
  { id: 'r2', capacity: 2, entry: 50, waiting: 1, estDurationSec: 45 },
  { id: 'r5', capacity: 5, entry: 50, waiting: 3, estDurationSec: 75 },
  { id: 'r10', capacity: 10, entry: 50, waiting: 6, estDurationSec: 110 },
  { id: 'r20', capacity: 20, entry: 50, waiting: 14, estDurationSec: 150 },
];

export const ACHIEVEMENTS = [
  { id: 'a1', label: 'First Blast', description: 'Play your first game', icon: '💥', unlocked: true },
  { id: 'a2', label: 'Hot Potato', description: 'Pass the bomb 10 times in one game', icon: '🥔', unlocked: true },
  { id: 'a3', label: 'Buzzer Beater', description: 'Survive with under 1s left', icon: '⏱️', unlocked: true },
  { id: 'a4', label: 'Untouchable', description: 'Win 3 games in a row', icon: '🔥', unlocked: false },
  { id: 'a5', label: 'Arena Legend', description: 'Reach level 20', icon: '👑', unlocked: false },
  { id: 'a6', label: 'Party Animal', description: 'Play 100 games', icon: '🎉', unlocked: false },
];
