import { describe, expect, it } from 'vitest';
import { canonicalRedirectUrl, shouldRedirectToCanonical, siteOrigin } from './site';

describe('canonical site origin', () => {
  it('redirects Railway and apex hosts to www.clashr.fun', () => {
    expect(shouldRedirectToCanonical('clashr-production.up.railway.app')).toBe(true);
    expect(shouldRedirectToCanonical('clashr.fun')).toBe(true);
    expect(canonicalRedirectUrl('clashr-production.up.railway.app', '/party/KJZA6U?vis=public')).toBe(
      'https://www.clashr.fun/party/KJZA6U?vis=public',
    );
  });

  it('leaves the canonical host and localhost alone', () => {
    expect(shouldRedirectToCanonical('www.clashr.fun')).toBe(false);
    expect(shouldRedirectToCanonical('localhost')).toBe(false);
    expect(siteOrigin('localhost', 'http://localhost:5173')).toBe('http://localhost:5173');
    expect(siteOrigin('www.clashr.fun')).toBe('https://www.clashr.fun');
  });
});
