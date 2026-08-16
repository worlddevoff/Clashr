import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getSolPotsConfig,
  refreshSolPots,
  solPotsEnabled,
  subscribeSolPots,
  type SolPotsConfig,
} from '../lib/solPots';

const SolPotsContext = createContext<SolPotsConfig>(getSolPotsConfig());

export function SolPotsProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState(getSolPotsConfig);

  useEffect(() => {
    void refreshSolPots();
    const unsub = subscribeSolPots(() => setConfig(getSolPotsConfig()));
    const tick = window.setInterval(() => void refreshSolPots(), 30_000);
    return () => {
      unsub();
      window.clearInterval(tick);
    };
  }, []);

  return <SolPotsContext.Provider value={config}>{children}</SolPotsContext.Provider>;
}

export function useSolPots(): boolean {
  const cfg = useContext(SolPotsContext);
  return cfg.solPots || solPotsEnabled();
}

export function useSolPotsConfig(): SolPotsConfig {
  return useContext(SolPotsContext);
}
