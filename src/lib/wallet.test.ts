import { afterEach, describe, expect, it, vi } from 'vitest';
import { restoreSolanaConnection, walletErrorMessage } from './wallet';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('walletErrorMessage', () => {
  it('reads Phantom-style plain objects', () => {
    expect(walletErrorMessage({ code: 4001, message: 'User rejected the request.' })).toBe(
      'User rejected the request.',
    );
  });

  it('reads Error instances', () => {
    expect(walletErrorMessage(new Error('Nope'))).toBe('Nope');
  });
});

describe('restoreSolanaConnection', () => {
  it('silently reconnects a previously trusted wallet', async () => {
    const publicKey = { toString: () => 'trusted-address', toBytes: () => new Uint8Array() };
    const connect = vi.fn().mockResolvedValue({ publicKey });
    vi.stubGlobal('window', {
      phantom: { solana: { isPhantom: true, publicKey: null, connect } },
    });

    await expect(restoreSolanaConnection()).resolves.toBe('trusted-address');
    expect(connect).toHaveBeenCalledWith({ onlyIfTrusted: true });
  });

  it('does not fail the session when silent reconnect is unavailable', async () => {
    const connect = vi.fn().mockRejectedValue(new Error('Not trusted'));
    vi.stubGlobal('window', {
      phantom: { solana: { isPhantom: true, publicKey: null, connect } },
    });

    await expect(restoreSolanaConnection()).resolves.toBeNull();
  });
});
