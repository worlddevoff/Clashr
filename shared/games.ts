export const GAME_SLUGS = ['bomb-party', 'tower'] as const;
export type GameSlug = (typeof GAME_SLUGS)[number];

export const CREDITS_DISCLAIMER =
  'VIRTUAL / DEMO CREDITS — NO REAL-WORLD VALUE';

export const TOWER_ENTRY_CREDITS = 100;
export const TOWER_MATCH_SIZE = 10;
export const TOWER_PLATFORM_FEE_BPS = 500; // 5%
export const TOWER_STARTING_CREDITS = 1000;

export function isGameSlug(value: string): value is GameSlug {
  return (GAME_SLUGS as readonly string[]).includes(value);
}

export function playPath(slug: GameSlug): string {
  return `/play/${slug}`;
}

export function gamePath(slug: GameSlug, roomId: string, query = ''): string {
  const q = query ? `?${query.replace(/^\?/, '')}` : '';
  return `/game/${slug}/${roomId}${q}`;
}
