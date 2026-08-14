import { describe, expect, it } from 'vitest';

function challengeMessage(address: string, nonce: string): string {
  return [
    'Sign in to CLASHR',
    '',
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    '',
    'This signature proves wallet ownership. It does not move funds.',
    'Tower credits are virtual/demo only.',
  ].join('\n');
}

describe('auth challenge', () => {
  it('includes nonce and demo-credit copy', () => {
    const msg = challengeMessage('Addr111', 'abc');
    expect(msg).toContain('Nonce: abc');
    expect(msg).toContain('virtual/demo');
  });
});
