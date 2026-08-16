export const CANONICAL_ORIGIN = 'https://www.clashr.fun';
export const CANONICAL_HOST = 'www.clashr.fun';

export function hostnameOnly(host: string): string {
  return host.trim().toLowerCase().split(':')[0] ?? '';
}

export function isLocalHost(host: string): boolean {
  const h = hostnameOnly(host);
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local');
}

/** Railway preview hosts and the apex domain should not talk to Phantom. */
export function shouldRedirectToCanonical(host: string): boolean {
  const h = hostnameOnly(host);
  if (!h || isLocalHost(h) || h === CANONICAL_HOST) return false;
  return h === 'clashr.fun' || h.endsWith('.up.railway.app');
}

export function canonicalRedirectUrl(host: string, originalUrl: string): string | null {
  if (!shouldRedirectToCanonical(host)) return null;
  const path = originalUrl.startsWith('/') ? originalUrl : `/${originalUrl}`;
  return `${CANONICAL_ORIGIN}${path}`;
}

export function siteOrigin(host?: string, origin?: string): string {
  const h = host ?? (typeof window !== 'undefined' ? window.location.hostname : CANONICAL_HOST);
  if (isLocalHost(h)) {
    return origin ?? (typeof window !== 'undefined' ? window.location.origin : CANONICAL_ORIGIN);
  }
  return CANONICAL_ORIGIN;
}
