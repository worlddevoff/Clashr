import { describe, expect, it } from 'vitest';
import { partyIdSeed } from './escrowOracle.ts';

describe('partyIdSeed', () => {
  it('matches the on-chain 8-char uppercase seed', () => {
    const buf = partyIdSeed('ab-12xy');
    expect(buf.length).toBe(32);
    expect(buf.subarray(0, 6).toString('utf8')).toBe('AB12XY');
    expect(buf[6]).toBe(0);
  });
});
