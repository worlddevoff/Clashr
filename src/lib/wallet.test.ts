import { describe, expect, it } from 'vitest';
import { walletErrorMessage } from './wallet';

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
