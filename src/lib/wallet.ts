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

/** Phantom often throws a plain `{ message }` instead of Error. */
export function walletErrorMessage(err: unknown, fallback = 'Wallet connection failed.'): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === 'string' && err.trim()) return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export async function waitForSolanaProvider(ms = 2500): Promise<SolanaProvider | null> {
  const existing = getSolanaProvider();
  if (existing) return existing;
  const deadline = Date.now() + ms;
  return new Promise((resolve) => {
    let done = false;
    const finish = (provider: SolanaProvider | null) => {
      if (done) return;
      done = true;
      window.removeEventListener('load', onLoad);
      window.removeEventListener('phantom#initialized', onLoad);
      resolve(provider);
    };
    const poll = () => {
      if (done) return;
      const provider = getSolanaProvider();
      if (provider) return finish(provider);
      if (Date.now() >= deadline) return finish(null);
      window.setTimeout(poll, 80);
    };
    const onLoad = () => poll();
    window.addEventListener('load', onLoad);
    window.addEventListener('phantom#initialized', onLoad);
    poll();
  });
}

function isMobileBrowser(): boolean {
  return /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent);
}

function openInPhantomBrowser(): void {
  const url = encodeURIComponent(window.location.href);
  const ref = encodeURIComponent(window.location.origin);
  window.location.href = `https://phantom.app/ul/browse/${url}?ref=${ref}`;
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
  const provider = await waitForSolanaProvider();
  if (!provider) {
    if (isMobileBrowser()) {
      openInPhantomBrowser();
      throw new Error('Opening in Phantom. After it loads, tap Connect wallet again.');
    }
    throw new Error('Phantom not detected on this tab. Click the Phantom extension icon, then try again.');
  }
  try {
    const res = await provider.connect();
    const address = res.publicKey?.toString() ?? provider.publicKey?.toString();
    if (!address) throw new Error('Wallet connection was cancelled.');
    return address;
  } catch (err) {
    const message = walletErrorMessage(err, 'Wallet connection was cancelled.');
    if (/reject|denied|cancel/i.test(message)) {
      throw new Error(
        'Phantom rejected this site. It may show a “new domain” warning for www.clashr.fun — approve that, then connect again.',
      );
    }
    throw new Error(message);
  }
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
