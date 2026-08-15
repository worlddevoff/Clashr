import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WalletIcon, LoaderCircleIcon } from 'lucide-react';
import { Button } from './ui/Button';
import { Logo } from './ui/Logo';
import { useAuth } from '../contexts/AuthContext';
import { SITE_TAGLINE, SITE_TITLE } from '../lib/brand';

// Shown when a visitor tries to play without a wallet.
export function AuthGate({ onAuth }: { onAuth: () => void }) {
  const { connectWallet, connecting } = useAuth();
  const navigate = useNavigate();

  const onConnect = async () => {
    const res = await connectWallet();
    if (!res.ok) {
      onAuth();
      return;
    }
    if (res.isNew) {
      onAuth();
      return;
    }
    navigate('/play');
  };

  return (
    <section className="relative mx-auto flex min-h-[calc(100vh-8rem)] max-w-3xl flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className="relative mb-6 text-7xl"
      >
        💣
      </motion.div>
      <h1 className="relative">
        <span className="sr-only">{SITE_TITLE}</span>
        <Logo className="text-4xl sm:text-5xl" />
      </h1>
      <p className="relative mt-3 max-w-md text-white/60">
        {SITE_TAGLINE}. Connect a Solana wallet to play — including free games vs bots.
      </p>
      <div className="relative mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" disabled={connecting} onClick={onConnect}>
          {connecting ? (
            <LoaderCircleIcon className="h-5 w-5 animate-spin" />
          ) : (
            <WalletIcon className="h-5 w-5" />
          )}
          {connecting ? 'Connecting…' : 'Connect wallet to play'}
        </Button>
        <Button size="lg" variant="secondary" onClick={() => navigate('/')}>
          Back to home
        </Button>
      </div>
      <p className="relative mt-6 text-[11px] uppercase tracking-widest text-white/25">
        Browse free · Wallet required to play
      </p>
    </section>
  );
}
