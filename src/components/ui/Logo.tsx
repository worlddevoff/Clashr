import { cn } from '../../utils/cn';

export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <img
        src="/clashr-wordmark.png"
        alt="Clashr: Crypto PvP Games & Online Gaming"
        className={cn(
          'w-auto object-contain object-left mix-blend-screen',
          compact ? 'h-6' : 'h-7 sm:h-8',
        )}
      />
    </span>
  );
}
