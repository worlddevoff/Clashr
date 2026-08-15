import { twMerge } from 'tailwind-merge';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return twMerge(parts.filter(Boolean).join(' '));
}

export const ACCENT_HEX: Record<string, string> = {
  cyan: '#2fe0f0',
  magenta: '#ff2f9e',
  lime: '#c9f74a',
  amber: '#ffb020',
  violet: '#a78bfa',
};
