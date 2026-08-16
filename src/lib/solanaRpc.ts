import { getSolanaProvider } from './wallet';
import { apiJson } from './api';
import { Transaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

export function friendlyRpcError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/Attempt to load a program that does not exist|incorrect program id|Invalid program id/i.test(msg)) {
    return 'Escrow program is on Solana Devnet. Sign in Phantom, then we submit the stake on Devnet — do not switch Phantom to Mainnet and resend.';
  }
  if (/slow down/i.test(msg)) {
    return 'Too many stake attempts. Wait a minute, then tap Retry stake once.';
  }
  if (/rate limit|429/i.test(msg)) {
    return 'Solana RPC is busy. Tap Retry stake once — do not spam the button.';
  }
  if (/free plan|paid plan|upgrade to paid|not available on/i.test(msg)) {
    return 'Could not reach Solana. Tap Retry stake once.';
  }
  if (/unauthorized|api key|authenticate your request|missing api key/i.test(msg)) {
    return 'Could not reach Solana. Tap Retry stake.';
  }
  if (/Blockhash not found|blockhash not found|expired.*blockhash/i.test(msg)) {
    return 'Solana dropped the transaction (took too long to approve). Tap stake again right away.';
  }
  if (/403|Access forbidden|forbidden|failed to get balance/i.test(msg)) {
    return 'Could not reach Solana. Approve in Phantom if it opens — otherwise try again.';
  }
  if (/blocked|malicious|unsafe|for your safety/i.test(msg)) {
    return 'Phantom blocked the Railway URL. Open https://www.clashr.fun and tap stake there.';
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
  return /429|rate limit|slow down/i.test(err instanceof Error ? err.message : String(err));
}

/** Browser never talks to public Solana RPCs — Node forwards allowlisted methods. */
export async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const data = await apiJson<{ result: T }>('/api/solana/rpc', {
    method: 'POST',
    body: JSON.stringify({ method, params }),
  });
  return data.result;
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
  if (!provider.signTransaction) {
    throw new Error('This wallet cannot sign transactions. Try Phantom.');
  }

  // Sign locally, then broadcast through the match server on Devnet. Phantom's
  // signAndSendTransaction uses whatever network the extension is on (usually
  // Mainnet), which makes Devnet pots look like they "don't exist".
  const signed = (await provider.signTransaction(tx)) as Transaction;
  const raw = signed.serialize();
  const b64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(raw).toString('base64')
      : btoa(String.fromCharCode(...raw));
  return rpc<string>('sendTransaction', [
    b64,
    { encoding: 'base64', skipPreflight: true, maxRetries: 0 },
  ]);
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
