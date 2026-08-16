import { apiJson } from './api';

export interface SolPotsConfig {
  solPots: boolean;
  cluster: string;
  treasury: string;
  oracle: string;
  programId: string;
  reason: string;
}

let cached: SolPotsConfig = {
  solPots: false,
  cluster: import.meta.env.VITE_SOLANA_CLUSTER?.trim() || 'devnet',
  treasury: import.meta.env.VITE_TREASURY_WALLET?.trim() || '',
  oracle: import.meta.env.VITE_ORACLE_WALLET?.trim() || '',
  programId: import.meta.env.VITE_ESCROW_PROGRAM_ID?.trim() || '',
  reason: 'loading',
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const cb of listeners) cb();
}

/** True when the match server can settle on-chain (house key + program). */
export function solPotsEnabled(): boolean {
  return cached.solPots;
}

export function getSolPotsConfig(): SolPotsConfig {
  return cached;
}

export function subscribeSolPots(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function refreshSolPots(): Promise<SolPotsConfig> {
  try {
    const next = await apiJson<SolPotsConfig>('/api/config', {
      signal: AbortSignal.timeout(5000),
    });
    cached = {
      solPots: !!next.solPots,
      cluster: next.cluster || cached.cluster,
      treasury: next.treasury || cached.treasury,
      oracle: next.oracle || cached.oracle,
      programId: next.programId || cached.programId,
      reason: next.reason || (next.solPots ? 'ok' : 'unavailable'),
    };
  } catch {
    cached = {
      ...cached,
      solPots: cached.solPots || !!cached.programId,
      reason: 'config_unreachable',
    };
  }
  emit();
  return cached;
}
