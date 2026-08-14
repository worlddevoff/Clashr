import { getSolanaRpcFallbacks } from './solanaConfig';
import { getSolanaProvider } from './wallet';
import { Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

export function friendlyRpcError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Attempt to load a program that does not exist|incorrect program id|Invalid program id/i.test(msg)) {
    return 'Match escrow program is not deployed on this cluster yet.';
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

export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let last = 'All Solana RPCs failed.';
  for (const url of getSolanaRpcFallbacks()) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      const json = (await res.json()) as { result?: T; error?: { message?: string; code?: number } };
      if (!res.ok || json.error) {
        last = json.error?.message ?? `${res.status} ${res.statusText}`;
        if (/403|forbidden|429/i.test(last)) continue;
        throw new Error(last);
      }
      if (json.result === undefined) {
        last = 'Empty RPC result';
        continue;
      }
      return json.result;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
      if (/403|forbidden|429|failed to fetch|network/i.test(last)) continue;
      throw e;
    }
  }
  throw new Error(last);
}

export async function sendSignedTransaction(tx: Transaction): Promise<string> {
  const provider = getSolanaProvider();
  if (!provider?.publicKey) {
    throw new Error('Connect your Solana wallet.');
  }

  let signature: string;
  if (provider.signTransaction) {
    const signed = (await provider.signTransaction(tx)) as Transaction;
    const raw = signed.serialize();
    const b64 =
      typeof Buffer !== 'undefined'
        ? Buffer.from(raw).toString('base64')
        : btoa(String.fromCharCode(...raw));
    signature = await rpc<string>('sendTransaction', [
      b64,
      { encoding: 'base64', skipPreflight: false, maxRetries: 3 },
    ]);
  } else if (provider.signAndSendTransaction) {
    const sent = await provider.signAndSendTransaction(tx);
    signature = sent.signature;
  } else {
    throw new Error('This wallet cannot send transactions. Try Phantom.');
  }

  for (let i = 0; i < 40; i++) {
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
    await new Promise((r) => window.setTimeout(r, 400));
  }
  return signature;
}
