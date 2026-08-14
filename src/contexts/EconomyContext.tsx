import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { ArcadeProviders } from '../providers/interfaces';
import { createMockProviders } from '../providers/mock';
import { useAuth } from './AuthContext';

interface EconomyValue {
  providers: ArcadeProviders;
}

const EconomyContext = createContext<EconomyValue | null>(null);

export function EconomyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const wallet = user?.walletAddress;

  const providers = useMemo(
    () =>
      createMockProviders({
        read: () => 0,
        write: () => undefined,
        isConnected: () => !!wallet,
      }),
    [wallet],
  );

  const value = useMemo<EconomyValue>(() => ({ providers }), [providers]);

  return <EconomyContext.Provider value={value}>{children}</EconomyContext.Provider>;
}

export function useEconomy(): EconomyValue {
  const ctx = useContext(EconomyContext);
  if (!ctx) throw new Error('useEconomy must be used within EconomyProvider');
  return ctx;
}
