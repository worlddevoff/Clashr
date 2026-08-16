/** Hostnames we serve in production even when CORS_ORIGINS is unset. */
const DEFAULT_HOSTS = new Set(['www.clashr.fun', 'clashr.fun']);

export function parseCorsOrigins(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function hostnameOf(hostOrOrigin: string): string | null {
  const value = hostOrOrigin.trim();
  if (!value) return null;
  try {
    if (value.includes('://')) return new URL(value).hostname.toLowerCase();
    return new URL(`http://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function originAllowed(
  origin: string | undefined,
  reqHost?: string,
  opts?: { corsOrigins?: string[]; isProd?: boolean },
): boolean {
  if (!origin) return true;
  const corsOrigins = opts?.corsOrigins ?? parseCorsOrigins(process.env.CORS_ORIGINS);
  const isProd = opts?.isProd ?? process.env.NODE_ENV === 'production';
  if (corsOrigins.includes(origin)) return true;

  const originHost = hostnameOf(origin);
  if (!originHost) return false;
  if (DEFAULT_HOSTS.has(originHost)) return true;
  if (reqHost) {
    const reqHostname = hostnameOf(reqHost.split(',')[0] ?? '');
    if (reqHostname && originHost === reqHostname) return true;
  }
  return !isProd && corsOrigins.length === 0;
}
