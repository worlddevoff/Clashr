// Wallet-gated authentication. Identity = Solana address after signMessage.
// Sessions persist to localStorage; profiles and balances are keyed by address.
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
import {
  connectSolana,
  disconnectSolana,
  getConnectedAddress,
  getSolanaProvider,
  normalizeAddress,
  shortAddress,
  signArcadeLogin,
  type SolanaPublicKey,
} from '../lib/wallet';

const STORAGE_KEY = 'arcade.user.v3';
const PROFILES_KEY = 'arcade.profiles.v3';

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
}

const AuthContext = createContext<AuthValue | null>(null);

type ProfileStore = Record<string, User>;

function readProfiles(): ProfileStore {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (raw) return JSON.parse(raw) as ProfileStore;
  } catch {
    /* ignore */
  }
  return {};
}

function writeProfiles(store: ProfileStore) {
  try {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

function defaultUsername(address: string): string {
  return shortAddress(address).replace('…', '');
}

function newUser(address: string, username: string, avatar: string, color: string): User {
  const id = normalizeAddress(address);
  return {
    id,
    username,
    avatar,
    color,
    level: 1,
    xp: 0,
    xpToNext: 500,
    gamesPlayed: 0,
    wins: 0,
    biggestWin: 0,
    streak: 0,
    walletAddress: id,
    walletConnected: true,
  };
}

function applyAccount(address: string | null, persistSession: (u: User | null) => void) {
  if (!address) {
    persistSession(null);
    return;
  }
  const addr = normalizeAddress(address);
  const profiles = readProfiles();
  const existing = profiles[addr];
  if (existing) {
    persistSession({ ...existing, walletConnected: true });
  } else {
    persistSession(null);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);

  const persistSession = useCallback((u: User | null) => {
    setUser(u);
    try {
      if (u) localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const saveProfile = useCallback((u: User) => {
    const store = readProfiles();
    store[normalizeAddress(u.walletAddress)] = u;
    writeProfiles(store);
  }, []);

  // Restore session if stored wallet still matches the injected Solana wallet
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const stored = JSON.parse(raw) as User;
        if (!stored?.walletAddress) {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }

        const provider = getSolanaProvider();
        if (provider) {
          try {
            await provider.connect({ onlyIfTrusted: true });
          } catch {
            /* not yet approved / locked */
          }
        }

        const live = await getConnectedAddress();
        if (cancelled) return;
        if (live && normalizeAddress(live) === normalizeAddress(stored.walletAddress)) {
          setUser({ ...stored, walletConnected: true });
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // React to account switches / disconnects
  useEffect(() => {
    const provider = getSolanaProvider();
    if (!provider?.on) return;

    const onAccountChanged = (publicKey: unknown) => {
      const key = publicKey as SolanaPublicKey | null;
      if (!key) {
        persistSession(null);
        setNeedsProfileSetup(false);
        setPendingAddress(null);
        return;
      }
      applyAccount(key.toString(), persistSession);
      setNeedsProfileSetup(false);
      setPendingAddress(null);
    };

    const onDisconnect = () => {
      persistSession(null);
      setNeedsProfileSetup(false);
      setPendingAddress(null);
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
      await signArcadeLogin(address);
      const id = normalizeAddress(address);
      const profiles = readProfiles();
      const existing = profiles[id];

      if (existing) {
        persistSession({ ...existing, walletConnected: true });
        setNeedsProfileSetup(false);
        setPendingAddress(null);
        return { ok: true, isNew: false };
      }

      setPendingAddress(id);
      setNeedsProfileSetup(true);
      const draft = newUser(id, defaultUsername(id), randomFrom(AVATARS), randomFrom(NEON_COLORS));
      persistSession(draft);
      saveProfile(draft);
      return { ok: true, isNew: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Wallet connection failed.';
      return { ok: false, message };
    } finally {
      setConnecting(false);
    }
  }, [persistSession, saveProfile]);

  const completeProfile = useCallback(
    (username: string, avatar: string, color: string) => {
      const name = username.trim().slice(0, 16);
      if (!user && !pendingAddress) return;
      const address = user?.walletAddress ?? pendingAddress!;
      const base =
        user ??
        newUser(address, defaultUsername(address), randomFrom(AVATARS), randomFrom(NEON_COLORS));
      const next: User = {
        ...base,
        username: name || defaultUsername(address),
        avatar,
        color,
        walletConnected: true,
      };
      saveProfile(next);
      persistSession(next);
      setNeedsProfileSetup(false);
      setPendingAddress(null);
    },
    [user, pendingAddress, persistSession, saveProfile],
  );

  const logOut = useCallback(() => {
    void disconnectSolana();
    persistSession(null);
    setNeedsProfileSetup(false);
    setPendingAddress(null);
  }, [persistSession]);

  const updateUser = useCallback(
    (patch: Partial<User>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        saveProfile(next);
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [saveProfile],
  );

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
    }),
    [user, connecting, connectWallet, completeProfile, needsProfileSetup, logOut, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
