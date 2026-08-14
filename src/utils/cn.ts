import { twMerge } from 'tailwind-merge';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(' '));
}

export const ACCENT_HEX: Record<string, string> = {
  cyan: '#22e5ff',
  magenta: '#ff2ea8',
  lime: '#b2ff59',
  amber: '#ffb020',
  violet: '#a06bff',
};
