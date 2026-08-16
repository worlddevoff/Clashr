import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon, WalletIcon, LoaderCircleIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AVATARS, NEON_COLORS } from '../data/avatars';
import { shortAddress } from '../lib/wallet';
import { Button } from './ui/Button';
import { Logo } from './ui/Logo';
import { cn } from '../utils/cn';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { connectWallet, completeProfile, needsProfileSetup, user, connecting } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [color, setColor] = useState(NEON_COLORS[0]);

  const showSetup = needsProfileSetup && !!user;

  const onConnect = async () => {
    setError(null);
    const res = await connectWallet();
    if (!res.ok) {
      setError(res.message);
      return;
    }
    if (!res.isNew) {
      onClose();
      navigate('/play');
    }
  };

  const onFinishProfile = (e: FormEvent) => {
    e.preventDefault();
    completeProfile(username || user?.username || 'Player', avatar, color);
    onClose();
    navigate('/play');
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Connect wallet"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-ink-600 bg-ink-850 p-6 shadow-panel"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 text-white/50 transition-colors hover:text-white"
            >
              <XIcon className="h-5 w-5" />
            </button>

            <div className="mb-5 flex flex-col items-center gap-3 text-center">
              <Logo />
              <p className="text-sm text-white/50">
                {showSetup
                  ? 'Customize your player. Practice vs bots is free. Real pots are SOL.'
                  : 'Connect your wallet to enter Clashr.'}
              </p>
            </div>

            {showSetup ? (
              <form onSubmit={onFinishProfile} className="space-y-5">
                <div className="rounded-xl border border-ink-600 bg-ink-800 px-3 py-2 text-center font-mono text-xs text-neon-cyan">
                  {user?.walletAddress ? shortAddress(user.walletAddress) : ''}
                </div>
                <div>
                  <label className="mb-1.5 block font-display text-[11px] uppercase tracking-wider text-white/50">
                    Username
                  </label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={user?.username || 'pick a handle'}
                    maxLength={16}
                    className="w-full rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-white placeholder:text-white/30 outline-none transition-colors focus:border-neon-cyan"
                  />
                </div>
                <div>
                  <span className="mb-1.5 block font-display text-[11px] uppercase tracking-wider text-white/50">
                    Character
                  </span>
                  <div className="grid grid-cols-8 gap-1.5">
                    {AVATARS.slice(0, 16).map((a) => (
                      <button
                        type="button"
                        key={a}
                        onClick={() => setAvatar(a)}
                        className={cn(
                          'grid aspect-square place-items-center rounded-lg border text-xl transition-colors',
                          avatar === a
                            ? 'border-neon-cyan bg-ink-700'
                            : 'border-ink-600 bg-ink-800 hover:border-white/30',
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="mb-1.5 block font-display text-[11px] uppercase tracking-wider text-white/50">
                    Neon color
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {NEON_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setColor(c)}
                        aria-label={`color ${c}`}
                        className={cn(
                          'h-8 w-8 rounded-full transition-transform',
                          color === c
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-ink-850 scale-110'
                            : 'hover:scale-110',
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full">
                  Enter Clashr
                </Button>
              </form>
            ) : (
              <div className="space-y-4">
                <Button size="lg" className="w-full" disabled={connecting} onClick={onConnect}>
                  {connecting ? (
                    <LoaderCircleIcon className="h-5 w-5 animate-spin" />
                  ) : (
                    <WalletIcon className="h-5 w-5" />
                  )}
                  {connecting ? 'Waiting for wallet…' : 'Connect wallet'}
                </Button>
                {error && (
                  <p className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-center text-sm text-red-300">
                    {error}
                  </p>
                )}
                <p className="text-center text-[11px] uppercase tracking-widest text-white/25">
                  Phantom &amp; other Solana wallets · Sign message to prove ownership
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
