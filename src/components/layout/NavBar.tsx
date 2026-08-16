import { NavLink, useNavigate } from 'react-router-dom';
import { HomeIcon, Gamepad2Icon, TrophyIcon, PlayIcon } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { WalletButton } from '../WalletButton';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../utils/cn';

export const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  { to: '/play', label: 'Play', icon: Gamepad2Icon, end: false },
  { to: '/leaderboard', label: 'Leaderboard', icon: TrophyIcon, end: false },
];

export function TopNav({ onAuth }: { onAuth: () => void }) {
  const { user, isAuthed } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-ink-950/85 backdrop-blur-md">
      <div className="border-b border-neon-magenta/30 bg-gradient-to-r from-neon-magenta/15 via-neon-magenta/25 to-neon-cyan/15 px-4 py-2 text-center font-display text-[11px] font-semibold uppercase tracking-[0.08em] text-white sm:text-xs">
        <span className="text-neon-cyan">⚔️ $CLASHR IS LIVE</span>
        <span aria-hidden="true"> — </span>
        <span>Get in early. Join the community. Help build the PvP crypto arcade.</span>
      </div>
      <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-8 px-5 lg:px-8">
        <NavLink to="/" className="shrink-0" aria-label="CLASHR home">
          <Logo />
        </NavLink>

        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    cn(
                      'rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 ease-snap',
                      isActive ? 'bg-white/5 text-white' : 'text-muted hover:bg-white/5 hover:text-white',
                    )
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li>
              <a
                href="/#how-it-works"
                className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors duration-150 ease-snap hover:bg-white/5 hover:text-white"
              >
                How it works
              </a>
            </li>
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2.5">
          {isAuthed ? (
            <>
              <WalletButton className="hidden sm:inline-flex" />
              <Button size="sm" className="hidden rounded-md sm:inline-flex" onClick={() => navigate('/play')}>
                <PlayIcon className="h-4 w-4" /> Play now
              </Button>
              <NavLink to="/profile" aria-label="Profile">
                <span
                  className="grid h-9 w-9 place-items-center rounded-md border text-lg"
                  style={{ borderColor: user?.color, boxShadow: `0 0 14px ${user?.color}55` }}
                >
                  {user?.avatar}
                </span>
              </NavLink>
            </>
          ) : (
            <>
              <Button size="sm" variant="secondary" className="hidden rounded-md sm:inline-flex" onClick={onAuth}>
                Connect wallet
              </Button>
              <Button size="sm" className="rounded-md" onClick={() => navigate('/play')}>
                <PlayIcon className="h-4 w-4" /> Play now
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-ink-950/95 backdrop-blur-xl lg:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isPlay = item.to === '/play';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2.5 text-[10px] font-display uppercase tracking-wide transition-colors duration-150',
                  isActive ? 'text-neon-cyan' : 'text-muted',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-md transition-colors',
                      isPlay && 'bg-neon-magenta text-white shadow-glow-magenta',
                      !isPlay && isActive && 'bg-ink-800',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.label}
                </>
              )}
            </NavLink>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
