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
    <header className="sticky top-0 z-50 border-b border-ink-700/80 bg-ink-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <NavLink to="/" className="shrink-0">
          <Logo />
        </NavLink>

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-2 font-display text-xs uppercase tracking-wide transition-colors duration-150',
                  isActive ? 'bg-ink-800 text-neon-cyan' : 'text-white/55 hover:text-white',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {isAuthed ? (
            <>
              <WalletButton className="hidden md:inline-flex" />
              <Button size="sm" className="hidden sm:inline-flex" onClick={() => navigate('/play')}>
                <PlayIcon className="h-4 w-4" /> Play
              </Button>
              <NavLink to="/profile" aria-label="Profile">
                <span
                  className="grid h-9 w-9 place-items-center rounded-xl border text-lg"
                  style={{ borderColor: user?.color, boxShadow: `0 0 14px ${user?.color}55` }}
                >
                  {user?.avatar}
                </span>
              </NavLink>
            </>
          ) : (
            <Button size="sm" onClick={onAuth}>
              Connect wallet
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-ink-700 bg-ink-950/95 backdrop-blur-xl lg:hidden">
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
                  isActive ? 'text-neon-cyan' : 'text-white/45',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-8 w-8 place-items-center rounded-xl transition-colors',
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
