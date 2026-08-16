import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from './ui/Button';
import { hasLegalAccept, saveLegalAccept } from '../lib/legal';
import { useAuth } from '../contexts/AuthContext';

export function LegalGate({ children }: { children: React.ReactNode }) {
  const { user, isAuthed } = useAuth();
  const location = useLocation();
  const [age18, setAge18] = useState(false);
  const [terms, setTerms] = useState(false);
  const [accepted, setAccepted] = useState(() => hasLegalAccept(user?.walletAddress));

  useEffect(() => {
    setAccepted(hasLegalAccept(user?.walletAddress));
  }, [user?.walletAddress]);

  const readingLegal =
    location.pathname === '/terms' ||
    location.pathname === '/privacy' ||
    location.pathname === '/responsible-play';

  if (!isAuthed || !user || accepted || hasLegalAccept(user.walletAddress) || readingLegal) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="pointer-events-none opacity-40">{children}</div>
      <div className="fixed inset-0 z-[80] grid place-items-center bg-ink-950/80 px-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-ink-600 bg-ink-900 p-6">
          <div className="font-display text-[11px] uppercase tracking-[0.22em] text-neon-amber">Required</div>
          <h2 className="mt-1 font-display text-2xl font-bold uppercase text-white">18+ and terms</h2>
          <p className="mt-2 text-sm text-white/55">
            Clashr pots are skill-based wagers in SOL. You must be 18 or older and accept the house
            rules before you can play or stake.
          </p>
          <label className="mt-5 flex items-start gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={age18}
              onChange={(e) => setAge18(e.target.checked)}
              className="mt-1"
            />
            I am at least 18 years old and legally allowed to play skill-based games for SOL where I live.
          </label>
          <label className="mt-3 flex items-start gap-3 text-sm text-white/80">
            <input
              type="checkbox"
              checked={terms}
              onChange={(e) => setTerms(e.target.checked)}
              className="mt-1"
            />
            <span>
              I accept the{' '}
              <Link to="/terms" className="text-neon-cyan underline">
                Terms
              </Link>
              ,{' '}
              <Link to="/privacy" className="text-neon-cyan underline">
                Privacy Policy
              </Link>
              , and{' '}
              <Link to="/responsible-play" className="text-neon-cyan underline">
                Responsible Play
              </Link>{' '}
              rules. SOL transfers are irreversible.
            </span>
          </label>
          <Button
            className="mt-6 w-full"
            disabled={!age18 || !terms}
            onClick={() => {
              saveLegalAccept(user.walletAddress);
              setAccepted(true);
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    </>
  );
}
