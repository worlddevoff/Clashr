/** Solana wallet helpers (Phantom, Solflare, and other injected providers). */

export interface SolanaPublicKey {
  toString(): string;
  toBytes(): Uint8Array;
}

export interface SolanaProvider {
  isPhantom?: boolean;
  publicKey: SolanaPublicKey | null;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: SolanaPublicKey }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, display?: 'utf8' | 'hex'): Promise<{ signature: Uint8Array }>;
  /** Phantom / Solflare — sign without sending (we broadcast via our RPC). */
  signTransaction?(transaction: unknown): Promise<unknown>;
  signAndSendTransaction?(
    transaction: unknown,
    opts?: { skipPreflight?: boolean },
  ): Promise<{ signature: string }>;
  on?(event: 'connect' | 'disconnect' | 'accountChanged', handler: (...args: unknown[]) => void): void;
  off?(event: 'connect' | 'disconnect' | 'accountChanged', handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    solana?: SolanaProvider;
    phantom?: { solana?: SolanaProvider };
    solflare?: SolanaProvider;
    Buffer?: typeof import('buffer').Buffer;
  }
}

export function getSolanaProvider(): SolanaProvider | null {
  if (typeof window === 'undefined') return null;
  const phantom = window.phantom?.solana;
  if (phantom?.isPhantom) return phantom;
  if (window.solflare) return window.solflare;
  if (window.solana) return window.solana;
  return null;
}

export function shortAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** Solana addresses are base58 and case-sensitive — do not lowercase. */
export function normalizeAddress(address: string): string {
  return address.trim();
}

export async function connectSolana(): Promise<string> {
  const provider = getSolanaProvider();
  if (!provider) {
    throw new Error('No Solana wallet found. Install Phantom and try again.');
  }
  const res = await provider.connect();
  const address = res.publicKey?.toString() ?? provider.publicKey?.toString();
  if (!address) throw new Error('Wallet connection was cancelled.');
  return address;
}

export async function getConnectedAddress(): Promise<string | null> {
  const provider = getSolanaProvider();
  if (!provider?.publicKey) return null;
  return provider.publicKey.toString();
}

/** Prove wallet ownership with a signed login message (no funds moved). */
export async function signArcadeLogin(address: string): Promise<string> {
  const provider = getSolanaProvider();
  if (!provider) throw new Error('No Solana wallet found.');

  const message = [
    'Sign in to CLASHR',
    '',
    `Wallet: ${address}`,
    `Time: ${new Date().toISOString()}`,
    '',
    'This signature proves wallet ownership. It does not move funds.',
  ].join('\n');

  return signArcadeMessage(message);
}

export async function signArcadeMessage(message: string): Promise<string> {
  const provider = getSolanaProvider();
  if (!provider) throw new Error('No Solana wallet found.');
  const encoded = new TextEncoder().encode(message);
  const { signature } = await provider.signMessage(encoded, 'utf8');
  return Array.from(signature)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function disconnectSolana(): Promise<void> {
  const provider = getSolanaProvider();
  if (!provider) return;
  try {
    await provider.disconnect();
  } catch {
    /* ignore */
  }
}
