/** Solana network + treasury config — no web3.js (safe to import on every page). */

/** 5% fee / bot-win receive address (public). */
export const TEST_TREASURY_WALLET = '259nG2nNP8GjCKRYqrcpsEJ14qfrra5yabjpU6axs7We';

export function getSolanaCluster(): string {
  return import.meta.env.VITE_SOLANA_CLUSTER?.trim() || 'devnet';
}

export function getSolanaRpcUrl(): string {
  const custom = import.meta.env.VITE_SOLANA_RPC?.trim();
  if (custom) return custom;
  const cluster = getSolanaCluster();
  if (cluster === 'devnet') return 'https://api.devnet.solana.com';
  if (cluster === 'testnet') return 'https://api.testnet.solana.com';
  // PublicNode is browser-friendly; api.mainnet-beta.solana.com often returns 403.
  return 'https://solana-rpc.publicnode.com';
}

export function getSolanaRpcFallbacks(): string[] {
  const cluster = getSolanaCluster();
  const primary = getSolanaRpcUrl();
  const extras =
    cluster === 'devnet'
      ? ['https://api.devnet.solana.com']
      : cluster === 'testnet'
        ? ['https://api.testnet.solana.com']
        : ['https://solana-rpc.publicnode.com', 'https://solana.drpc.org'];
  return [primary, ...extras.filter((u) => u !== primary)];
}

export function getTreasuryAddress(): string {
  return import.meta.env.VITE_TREASURY_WALLET?.trim() || TEST_TREASURY_WALLET;
}

/** House oracle that signs settle. Public only — secret stays on the server. */
export function getOracleAddress(): string {
  return import.meta.env.VITE_ORACLE_WALLET?.trim() || '';
}

export function explorerTxUrl(signature: string): string {
  const cluster = getSolanaCluster();
  const base = 'https://solscan.io/tx/';
  if (cluster === 'mainnet-beta') return `${base}${signature}`;
  return `${base}${signature}?cluster=${cluster}`;
}
