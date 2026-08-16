import { getSessionToken } from './session';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_ORIGIN;
  if (typeof raw === 'string' && raw.trim()) return raw.replace(/\/$/, '');
  return '';
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const withApi = p.startsWith('/api') ? p : `/api${p}`;
  return `${apiOrigin()}${withApi}`;
}

export function wsUrl(): string {
  const origin = apiOrigin();
  if (origin) {
    const u = new URL('/ws', origin);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return u.toString();
  }
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${window.location.host}/ws`;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getSessionToken();
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(apiUrl(path), { ...init, headers });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new ApiError(data.error || res.statusText, res.status);
  return data;
}
