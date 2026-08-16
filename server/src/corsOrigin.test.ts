import { describe, expect, it } from 'vitest';
import { hostnameOf, originAllowed } from './corsOrigin.ts';

const prod = { corsOrigins: [] as string[], isProd: true };

describe('originAllowed', () => {
  it('allows missing origin (server-to-server / same-origin without Origin)', () => {
    expect(originAllowed(undefined, 'www.clashr.fun', prod)).toBe(true);
  });

  it('allows www.clashr.fun without CORS_ORIGINS or matching Host', () => {
    expect(originAllowed('https://www.clashr.fun', undefined, prod)).toBe(true);
    expect(originAllowed('https://clashr.fun', undefined, prod)).toBe(true);
  });

  it('allows Origin when it matches the request Host', () => {
    expect(originAllowed('https://clashr-production.up.railway.app', 'clashr-production.up.railway.app', prod)).toBe(
      true,
    );
    expect(originAllowed('https://www.clashr.fun', 'www.clashr.fun:443', prod)).toBe(true);
  });

  it('allows listed CORS_ORIGINS', () => {
    expect(
      originAllowed('https://preview.example.com', undefined, {
        corsOrigins: ['https://preview.example.com'],
        isProd: true,
      }),
    ).toBe(true);
  });

  it('denies other hosts in production', () => {
    expect(originAllowed('https://evil.example', 'www.clashr.fun', prod)).toBe(false);
  });

  it('allows any origin in dev when CORS_ORIGINS is empty', () => {
    expect(originAllowed('http://127.0.0.1:5173', undefined, { corsOrigins: [], isProd: false })).toBe(true);
  });
});

describe('hostnameOf', () => {
  it('parses origins and Host headers', () => {
    expect(hostnameOf('https://www.clashr.fun')).toBe('www.clashr.fun');
    expect(hostnameOf('www.clashr.fun:443')).toBe('www.clashr.fun');
  });
});
