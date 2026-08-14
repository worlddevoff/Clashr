import { cn } from '../../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 font-display font-semibold uppercase tracking-wide rounded-xl transition-[transform,box-shadow,background-color,border-color] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-cyan/70 disabled:opacity-50 disabled:pointer-events-none select-none';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-neon-magenta text-white shadow-glow-magenta hover:brightness-110 hover:-translate-y-0.5',
  secondary:
    'bg-ink-700 text-white border border-ink-600 hover:border-neon-cyan/60 hover:text-neon-cyan hover:-translate-y-0.5',
  ghost: 'bg-transparent text-white/70 hover:text-white hover:bg-white/5',
  danger: 'bg-red-500 text-white hover:brightness-110 hover:-translate-y-0.5',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'text-xs px-3 py-2',
  md: 'text-sm px-4 py-2.5',
  lg: 'text-base px-6 py-3.5',
};

/** Button styling without the element, for cards that are themselves clickable. */
export function buttonClasses(opts?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}): string {
  return cn(base, variants[opts?.variant ?? 'primary'], sizes[opts?.size ?? 'md'], opts?.className);
}
