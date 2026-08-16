import { clusterName, rpcUrl } from './escrowOracle.ts';

/** Wallet stake/lock only needs these. Anything else is rejected. */
export const ALLOWED_SOLANA_RPC = new Set([
  'getLatestBlockhash',
  'getAccountInfo',
  'sendTransaction',
  'getSignatureStatuses',
]);

function isPublicSolanaHost(url: string): boolean {
  return /api\.(devnet|testnet|mainnet-beta)\.solana\.com/i.test(url);
}

function rpcEndpoints(): string[] {
  const primary = rpcUrl();
  const extras =
    clusterName() === 'devnet'
      ? [
          'https://solana-devnet.api.onfinality.io/public',
          'https://solana-devnet.drpc.org',
          'https://rpc.ankr.com/solana_devnet',
        ]
      : clusterName() === 'testnet'
        ? ['https://api.testnet.solana.com']
        : ['https://solana-rpc.publicnode.com', 'https://solana.drpc.org'];
  return [primary, ...extras.filter((u) => u !== primary && !isPublicSolanaHost(u))].filter(
    (u) => !isPublicSolanaHost(u),
  );
}

export function rpcEndpointList(): string[] {
  return rpcEndpoints();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRateLimit(status: number, message: string): boolean {
  return status === 429 || /rate limit|too many requests/i.test(message);
}

function isRetryable(status: number, message: string): boolean {
  return (
    isRateLimit(status, message) ||
    /timed out|abort|network|econnreset|fetch failed|socket/i.test(message)
  );
}

const RPC_TIMEOUT_MS = 8_000;

async function rpcAt(url: string, method: string, params: unknown[]): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), RPC_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => ({}))) as {
      result?: unknown;
      error?: { message?: string };
    };
    if (!res.ok || json.error) {
      const message = json.error?.message ?? `${res.status} ${res.statusText}`;
      const err = new Error(message) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    if (json.result === undefined) throw new Error('Empty RPC result');
    return json.result;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Solana RPC timed out');
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

let cachedBlockhash: { at: number; result: unknown } | null = null;
const BLOCKHASH_TTL_MS = 2_500;

export async function proxySolanaRpc(method: string, params: unknown[]): Promise<unknown> {
  if (!ALLOWED_SOLANA_RPC.has(method)) {
    throw new Error('RPC method not allowed');
  }
  if (!Array.isArray(params)) {
    throw new Error('params must be an array');
  }

  if (
    method === 'getLatestBlockhash' &&
    cachedBlockhash &&
    Date.now() - cachedBlockhash.at < BLOCKHASH_TTL_MS
  ) {
    return cachedBlockhash.result;
  }

  const urls = rpcEndpoints();
  let last = 'All Solana RPCs failed.';
  for (let attempt = 0; attempt < 3; attempt++) {
    let sawRateLimit = false;
    for (const url of urls) {
      try {
        const result = await rpcAt(url, method, params);
        if (method === 'getLatestBlockhash') {
          cachedBlockhash = { at: Date.now(), result };
        }
        return result;
      } catch (e) {
        last = e instanceof Error ? e.message : String(e);
        const status = e && typeof e === 'object' && 'status' in e ? Number(e.status) : 0;
        if (isRateLimit(status, last)) {
          sawRateLimit = true;
          continue;
        }
        if (isRetryable(status, last)) continue;
        throw e instanceof Error ? e : new Error(last);
      }
    }
    if (!sawRateLimit) break;
    await sleep(300 * 2 ** attempt);
  }
  throw new Error(last);
}
