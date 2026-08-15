// Wallet-gated authentication. Identity = Solana address after a server nonce sign-in.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { User } from '../types/domain';
import { AVATARS, NEON_COLORS, randomFrom } from '../data/avatars';
import { apiJson } from '../lib/api';
import { getSessionToken, setSessionToken } from '../lib/session';
import {
  connectSolana,
  disconnectSolana,
  getSolanaProvider,
  normalizeAddress,
  shortAddress,
  signArcadeMessage,
  type SolanaPublicKey,
} from '../lib/wallet';

export type ConnectWalletResult =
  | { ok: true; isNew: boolean }
  | { ok: false; message: string };

interface AuthValue {
  user: User | null;
  isAuthed: boolean;
  connecting: boolean;
  connectWallet: () => Promise<ConnectWalletResult>;
  completeProfile: (username: string, avatar: string, color: string) => void;
  needsProfileSetup: boolean;
  logOut: () => void;
  updateUser: (patch: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

function defaultUsername(address: string): string {
  return shortAddress(address).replace('…', '');
}

function asUser(raw: User | null | undefined): User | null {
  if (!raw?.id) return null;
  return { ...raw, walletAddress: raw.walletAddress || raw.id, walletConnected: true };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  const persistSession = useCallback((u: User | null) => {
    setUser(u);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = getSessionToken();
    if (!token) {
      persistSession(null);
      return;
    }
    try {
      const data = await apiJson<{ user: User | null }>('/api/me');
      persistSession(asUser(data.user));
    } catch {
      setSessionToken(null);
      persistSession(null);
    }
  }, [persistSession]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  useEffect(() => {
    const provider = getSolanaProvider();
    if (!provider?.on) return;

    const onAccountChanged = (publicKey: unknown) => {
      const key = publicKey as SolanaPublicKey | null;
      if (!key) {
        setSessionToken(null);
        persistSession(null);
        setNeedsProfileSetup(false);
        return;
      }
      const next = normalizeAddress(key.toString());
      setUser((prev) => {
        if (prev && normalizeAddress(prev.id) !== next) {
          setSessionToken(null);
          setNeedsProfileSetup(false);
          return null;
        }
        return prev;
      });
    };

    const onDisconnect = () => {
      setSessionToken(null);
      persistSession(null);
      setNeedsProfileSetup(false);
    };

    provider.on('accountChanged', onAccountChanged);
    provider.on('disconnect', onDisconnect);
    return () => {
      provider.off?.('accountChanged', onAccountChanged);
      provider.off?.('disconnect', onDisconnect);
      provider.removeListener?.('accountChanged', onAccountChanged);
      provider.removeListener?.('disconnect', onDisconnect);
    };
  }, [persistSession]);

  const connectWallet = useCallback(async (): Promise<ConnectWalletResult> => {
    setConnecting(true);
    try {
      const address = await connectSolana();
      const id = normalizeAddress(address);
      const ch = await apiJson<{ nonce: string; message: string }>('/api/auth/challenge', {
        method: 'POST',
        body: JSON.stringify({ address: id }),
      });
      const signatureHex = await signArcadeMessage(ch.message);
      const out = await apiJson<{
        token: string;
        isNew: boolean;
        user: User | null;
      }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          address: id,
          nonce: ch.nonce,
          signatureHex,
          username: defaultUsername(id),
          avatar: randomFrom(AVATARS),
          color: randomFrom(NEON_COLORS),
        }),
      });
      setSessionToken(out.token);
      persistSession(asUser(out.user) ?? {
        id,
        username: defaultUsername(id),
        avatar: randomFrom(AVATARS),
        color: randomFrom(NEON_COLORS),
        level: 1,
        xp: 0,
        xpToNext: 100,
        gamesPlayed: 0,
        wins: 0,
        biggestWin: 0,
        streak: 0,
        walletAddress: id,
        walletConnected: true,
      });
      setNeedsProfileSetup(out.isNew);
      return { ok: true, isNew: out.isNew };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection failed.';
      return { ok: false, message };
    } finally {
      setConnecting(false);
    }
  }, [persistSession]);

  const completeProfile = useCallback(
    (username: string, avatar: string, color: string) => {
      const name = username.trim().slice(0, 16);
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, username: name || prev.username, avatar, color };
        void apiJson('/api/me', {
          method: 'PATCH',
          body: JSON.stringify({ username: next.username, avatar, color }),
        })
          .then((data) => {
            const body = data as { user?: User };
            if (body.user) persistSession(asUser(body.user));
          })
          .catch(() => undefined);
        return next;
      });
      setNeedsProfileSetup(false);
    },
    [persistSession],
  );

  const logOut = useCallback(() => {
    void disconnectSolana();
    setSessionToken(null);
    persistSession(null);
    setNeedsProfileSetup(false);
  }, [persistSession]);

  const updateUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      isAuthed: !!user,
      connecting,
      connectWallet,
      completeProfile,
      needsProfileSetup,
      logOut,
      updateUser,
      refreshUser,
    }),
    [user, connecting, connectWallet, completeProfile, needsProfileSetup, logOut, updateUser, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
