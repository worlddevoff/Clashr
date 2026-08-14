/** Solana network + treasury config — no web3.js (safe to import on every page). */

export const TEST_TREASURY_WALLET = 'FhBqhrNJ4VNEG9JANerxgKt1L8hYhugXCgXrefqSBw3j';

export function getSolanaCluster(): string {
  return import.meta.env.VITE_SOLANA_CLUSTER?.trim() || 'mainnet-beta';
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
  const primary = getSolanaRpcUrl();
  const extras = [
    'https://solana-rpc.publicnode.com',
    'https://solana.drpc.org',
    'https://rpc.ankr.com/solana',
  ];
  return [primary, ...extras.filter((u) => u !== primary)];
}

export function getTreasuryAddress(): string {
  return import.meta.env.VITE_TREASURY_WALLET?.trim() || TEST_TREASURY_WALLET;
}

export function explorerTxUrl(signature: string): string {
  const cluster = getSolanaCluster();
  const base = 'https://solscan.io/tx/';
  if (cluster === 'mainnet-beta') return `${base}${signature}`;
  return `${base}${signature}?cluster=${cluster}`;
}
