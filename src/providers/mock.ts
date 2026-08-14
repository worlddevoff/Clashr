// Mock, virtual-credit-only implementations of the future-money interfaces.
// These are the ONLY implementations shipped in the MVP. They never move real
// funds. Balance is delegated to a callback so the Economy context stays the
// single source of truth for demo credits.
import type {
  ArcadeProviders,
  GameEntryProvider,
  PaymentProvider,
  PayoutProvider,
  PlayerVerificationProvider,
  PrizePoolProvider,
  RandomnessProvider,
  WalletProvider,
} from './interfaces';
import type { Credits, PlayerId } from '../types/domain';

/** Clearly disclosed platform/game fee. Applied to the gross pool. */
export const PLATFORM_FEE_RATE = 0.05;

interface BalanceBridge {
  read: () => Credits;
  write: (next: Credits) => void;
  isConnected?: () => boolean;
}

function fnv1aHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function createMockProviders(bridge: BalanceBridge): ArcadeProviders {
  // Auth owns real wallet connect; this provider only reports connection state
  // and the virtual credit balance until a real payment rail ships.
  const wallet: WalletProvider = {
    kind: 'crypto',
    isConnected: () => bridge.isConnected?.() ?? false,
    async connect() {
      return {
        ok: bridge.isConnected?.() ?? false,
        message: bridge.isConnected?.()
          ? 'Wallet connected'
          : 'Connect your wallet to sign in',
      };
    },
    async disconnect() {},
    async getBalance() {
      return bridge.read();
    },
  };

  const payment: PaymentProvider = {
    kind: 'virtual',
    async credit(_p, amount) {
      bridge.write(bridge.read() + amount);
      return bridge.read();
    },
    async debit(_p, amount) {
      bridge.write(Math.max(0, bridge.read() - amount));
      return bridge.read();
    },
  };

  const entry: GameEntryProvider = {
    async enterGame(_p, _g, stake) {
      const bal = bridge.read();
      if (bal < stake) return { ok: false, balance: bal };
      bridge.write(bal - stake);
      return { ok: true, balance: bridge.read() };
    },
  };

  const prizePool: PrizePoolProvider = {
    computePool(entryAmount, playerCount, feeRate) {
      const gross = entryAmount * playerCount;
      const platformFee = Math.round(gross * feeRate);
      return { gross, platformFee, prizePool: gross - platformFee };
    },
  };

  const payout: PayoutProvider = {
    async payout(_p, _g, amount) {
      bridge.write(bridge.read() + amount);
      return bridge.read();
    },
  };

  const randomness: RandomnessProvider = {
    serverSeed() {
      return (
        Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
      );
    },
    hashSeed(seed) {
      return `0x${fnv1aHash(seed)}${fnv1aHash(seed.split('').reverse().join(''))}`;
    },
    pick<T>(items: T[]): T {
      return items[Math.floor(Math.random() * items.length)];
    },
  };

  const verification: PlayerVerificationProvider = {
    async isEligible(_p: PlayerId) {
      // MVP: everyone can play with virtual credits. A compliant build would
      // enforce KYC / geo / age gating before real-money entry.
      return { eligible: true };
    },
  };

  return { wallet, payment, entry, prizePool, payout, randomness, verification };
}
