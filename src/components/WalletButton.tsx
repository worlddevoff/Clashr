import { useState } from 'react';
import { WalletIcon, LogOutIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { shortAddress } from '../lib/wallet';
import { cn } from '../utils/cn';

export function WalletButton({ className }: { className?: string }) {
  const { user, isAuthed, connectWallet, logOut, connecting } = useAuth();
  const [msg, setMsg] = useState<string | null>(null);

  const onClick = async () => {
    if (isAuthed) {
      logOut();
      setMsg('Disconnected');
      window.setTimeout(() => setMsg(null), 1800);
      return;
    }
    const res = await connectWallet();
    if (!res.ok) {
      setMsg(res.message);
      window.setTimeout(() => setMsg(null), 2600);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={connecting}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border bg-ink-800 px-3 py-2 font-display text-xs uppercase tracking-wide transition-colors duration-150 ease-out disabled:opacity-50',
          isAuthed
            ? 'border-ink-600 text-white/80 hover:border-neon-cyan/60 hover:text-neon-cyan'
            : 'border-dashed border-neon-cyan/40 text-neon-cyan/80 hover:border-neon-cyan hover:text-neon-cyan',
          className,
        )}
      >
        {isAuthed ? (
          <>
            <LogOutIcon className="h-4 w-4" aria-hidden />
            {user?.walletAddress ? shortAddress(user.walletAddress) : 'Disconnect'}
          </>
        ) : (
          <>
            <WalletIcon className="h-4 w-4" aria-hidden />
            {connecting ? 'Connecting…' : 'Connect Wallet'}
          </>
        )}
      </button>
      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
            className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-neon-cyan/30 bg-ink-850 px-3 py-2.5 text-center font-display text-[11px] uppercase tracking-wider text-neon-cyan shadow-glow-cyan"
            role="status"
          >
            {msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
