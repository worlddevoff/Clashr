import { getSolanaRpcFallbacks } from './solanaConfig';
import { getSolanaProvider } from './wallet';
import { Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

/** RPC used for the last getLatestBlockhash — send the signed tx to the same node. */
let stickyRpc: string | null = null;

export function friendlyRpcError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Attempt to load a program that does not exist|incorrect program id|Invalid program id/i.test(msg)) {
    return 'Match escrow program is not deployed on this cluster yet.';
  }
  if (/rate limit|429/i.test(msg)) {
    return 'Solana is rate-limiting this connection. Wait 20 seconds, then tap Retry stake once.';
  }
  if (/Blockhash not found|blockhash not found|expired.*blockhash/i.test(msg)) {
    return 'Solana dropped the transaction (took too long to approve). Tap stake again right away.';
  }
  if (/403|Access forbidden|forbidden|failed to get balance/i.test(msg)) {
    return 'Could not reach Solana. Approve in Phantom if it opens — otherwise try again.';
  }
  if (/User rejected|rejected|cancel/i.test(msg)) {
    return 'Transaction cancelled in wallet.';
  }
  if (/insufficient|0x1/i.test(msg)) {
    return 'Not enough SOL in this wallet (need the stake plus a tiny network fee).';
  }
  return msg || 'Transaction cancelled or failed.';
}

function isBlockhashError(err: unknown): boolean {
  return /blockhash not found|expired.*blockhash/i.test(err instanceof Error ? err.message : String(err));
}

function isRateLimit(err: unknown): boolean {
  return /429|rate limit/i.test(err instanceof Error ? err.message : String(err));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function rpcAt<T>(url: string, method: string, params: unknown[]): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = (await res.json()) as { result?: T; error?: { message?: string; code?: number } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `${res.status} ${res.statusText}`);
  }
  if (json.result === undefined) {
    throw new Error('Empty RPC result');
  }
  return json.result;
}

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const urls =
    method === 'sendTransaction' && stickyRpc
      ? [stickyRpc]
      : stickyRpc
        ? [stickyRpc, ...getSolanaRpcFallbacks().filter((u) => u !== stickyRpc)]
        : getSolanaRpcFallbacks();
  let last = 'All Solana RPCs failed.';
  for (const url of urls) {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = await rpcAt<T>(url, method, params);
        stickyRpc = url;
        return result;
      } catch (e) {
        last = e instanceof Error ? e.message : String(e);
        if (method === 'sendTransaction' && isBlockhashError(e)) throw e;
        if (isRateLimit(e)) {
          await sleep(800 * 2 ** attempt);
          continue;
        }
        if (/403|forbidden|failed to fetch|network/i.test(last)) break;
        throw e;
      }
    }
  }
  throw new Error(last);
}

export async function latestBlockhash(): Promise<string> {
  const latest = await rpc<{ value: { blockhash: string } }>('getLatestBlockhash', [
    { commitment: 'confirmed' },
  ]);
  return latest.value.blockhash;
}

export async function sendSignedTransaction(tx: Transaction): Promise<string> {
  const provider = getSolanaProvider();
  if (!provider?.publicKey) {
    throw new Error('Connect your Solana wallet.');
  }

  let signature: string;
  // Prefer the wallet's own RPC so public Devnet nodes are not hammered.
  if (provider.signAndSendTransaction) {
    const sent = await provider.signAndSendTransaction(tx);
    signature = sent.signature;
  } else if (provider.signTransaction) {
    const signed = (await provider.signTransaction(tx)) as Transaction;
    const raw = signed.serialize();
    const b64 =
      typeof Buffer !== 'undefined'
        ? Buffer.from(raw).toString('base64')
        : btoa(String.fromCharCode(...raw));
    signature = await rpc<string>('sendTransaction', [
      b64,
      { encoding: 'base64', skipPreflight: false, maxRetries: 5, preflightCommitment: 'confirmed' },
    ]);
  } else {
    throw new Error('This wallet cannot send transactions. Try Phantom.');
  }

  for (let i = 0; i < 12; i++) {
    try {
      const st = await rpc<{ value: Array<{ err: unknown; confirmationStatus?: string } | null> }>(
        'getSignatureStatuses',
        [[signature], { searchTransactionHistory: true }],
      );
      const info = st.value[0];
      if (info?.err) {
        throw new Error('Transaction failed on Solana.');
      }
      if (info?.confirmationStatus === 'confirmed' || info?.confirmationStatus === 'finalized') {
        return signature;
      }
    } catch (err) {
      if (isRateLimit(err)) return signature;
      throw err;
    }
    await sleep(1000);
  }
  return signature;
}

/** Rebuild + resign if Phantom sat on an expired blockhash. */
export async function sendWalletInstructions(build: (blockhash: string) => Transaction): Promise<string> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const blockhash = await latestBlockhash();
      return await sendSignedTransaction(build(blockhash));
    } catch (err) {
      last = err;
      if (isRateLimit(err)) throw err;
      if (!isBlockhashError(err) && !/blockhash/i.test(friendlyRpcError(err))) throw err;
    }
  }
  throw last instanceof Error ? last : new Error('Solana dropped the transaction. Try again.');
}
