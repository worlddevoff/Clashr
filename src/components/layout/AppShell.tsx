import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { BottomNav, TopNav } from './NavBar';
import { AuthModal } from '../AuthModal';
import { AuthGate } from '../AuthGate';
import { useAuth } from '../../contexts/AuthContext';

export function AppShell() {
  const { isAuthed } = useAuth();
  const location = useLocation();
  const [authOpen, setAuthOpen] = useState(false);
  const isPublicBrowse =
    location.pathname === '/' || location.pathname === '/leaderboard';

  return (
    <div className="flex min-h-full w-full flex-col bg-ink-950 text-white">
      <TopNav onAuth={() => setAuthOpen(true)} />
      <main className="flex-1 pb-24 lg:pb-0">
        {isAuthed || isPublicBrowse ? (
          <Outlet />
        ) : (
          <AuthGate onAuth={() => setAuthOpen(true)} />
        )}
      </main>
      <BottomNav />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
