import { describe, expect, it } from 'vitest';
import { ALLOWED_SOLANA_RPC, proxySolanaRpc, rpcEndpointList } from './solanaProxy.ts';

describe('solana RPC proxy allowlist', () => {
  it('allows stake methods', () => {
    expect(ALLOWED_SOLANA_RPC.has('getLatestBlockhash')).toBe(true);
    expect(ALLOWED_SOLANA_RPC.has('sendTransaction')).toBe(true);
    expect(ALLOWED_SOLANA_RPC.has('getAccountInfo')).toBe(true);
    expect(ALLOWED_SOLANA_RPC.has('getSignatureStatuses')).toBe(true);
  });

  it('rejects unrelated methods before hitting Solana', async () => {
    await expect(proxySolanaRpc('getBalance', ['x'])).rejects.toThrow('not allowed');
    await expect(proxySolanaRpc('getProgramAccounts', [])).rejects.toThrow('not allowed');
  });

  it('never uses public solana.com, Ankr, or dRPC hosts', () => {
    process.env.SOLANA_RPC = 'https://api.devnet.solana.com';
    process.env.VITE_SOLANA_CLUSTER = 'devnet';
    const urls = rpcEndpointList();
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((u) => !/api\.devnet\.solana\.com|ankr\.com|drpc\.org/i.test(u))).toBe(true);
  });
});
