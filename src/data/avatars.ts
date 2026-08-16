// Character roster used for avatars and bot opponents.
export const AVATARS = ['🐸', '🐙', '🦊', '🐵', '🐤', '🐷', '🦄', '🐲', '👾', '🤖', '🐧', '🐨', '🦁', '🐰', '🐹', '🦖', '🐼', '🐔', '🦩', '🐌'];

export const NEON_COLORS = ['#22e5ff', '#ff2b2b', '#b2ff59', '#ffb020', '#a06bff', '#ff6b6b', '#4dffb8', '#ff8fd8'];

export const BOT_NAMES = [
  'CryptoCat', 'Boomzilla', 'Zap', 'Pixel', 'Nitro', 'Fuse', 'Blitz', 'Vortex',
  'Gizmo', 'Sparky', 'Havoc', 'Rocket', 'Turbo', 'Chaos', 'Fizz', 'Bolt',
  'Quark', 'Neon', 'Jinx', 'Dash',
];

/** Display name for AI opponents — always labeled as bots. */
export function botDisplayName(base: string): string {
  const clean = base.replace(/^Bot\s+/i, '').trim();
  return `Bot ${clean}`;
}

export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
