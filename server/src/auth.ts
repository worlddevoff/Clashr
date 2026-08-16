import crypto from 'node:crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { prisma } from './db.ts';
import { TOWER_STARTING_CREDITS } from '../../shared/games.ts';

const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export async function issueNonce(address: string): Promise<string> {
  const nonce = crypto.randomBytes(16).toString('hex');
  await prisma.authNonce.create({ data: { nonce, address } });
  return nonce;
}

export function challengeMessage(address: string, nonce: string): string {
  return [
    'Sign in to CLASHR',
    '',
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    '',
    'This signature proves wallet ownership. It does not move funds.',
    'Tower credits are virtual/demo only.',
  ].join('\n');
}

export async function loginWithSignature(opts: {
  address: string;
  nonce: string;
  signatureHex: string;
  username?: string;
  avatar?: string;
  color?: string;
}): Promise<{ token: string; userId: string; isNew: boolean }> {
  const row = await prisma.authNonce.findUnique({ where: { nonce: opts.nonce } });
  if (!row || row.used || row.address !== opts.address) {
    throw new Error('Invalid or reused nonce');
  }
  const age = Date.now() - row.createdAt.getTime();
  if (age > 5 * 60 * 1000) throw new Error('Nonce expired');

  const msg = new TextEncoder().encode(challengeMessage(opts.address, opts.nonce));
  const sig = Buffer.from(opts.signatureHex, 'hex');
  const pub = bs58.decode(opts.address);
  const ok = nacl.sign.detached.verify(msg, new Uint8Array(sig), new Uint8Array(pub));
  if (!ok) throw new Error('Bad signature');

  await prisma.authNonce.update({ where: { nonce: opts.nonce }, data: { used: true } });

  const existed = await prisma.user.findUnique({ where: { id: opts.address } });
  const user = await prisma.user.upsert({
    where: { id: opts.address },
    create: {
      id: opts.address,
      username: opts.username || opts.address.slice(0, 6),
      avatar: opts.avatar || '🗼',
      color: opts.color || '#22e5ff',
      account: { create: { balance: TOWER_STARTING_CREDITS } },
    },
    update: {},
  });

  const existing = await prisma.creditAccount.findUnique({ where: { userId: user.id } });
  if (!existing) {
    await prisma.creditAccount.create({
      data: { userId: user.id, balance: TOWER_STARTING_CREDITS },
    });
  }

  const token = crypto.randomBytes(24).toString('hex');
  await prisma.$transaction(async (tx) => {
    const session = await tx.session.create({
      data: {
        userId: user.id,
        nonce: opts.nonce,
        token,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });
    await tx.walletConnectionEvent.create({
      data: {
        walletAddress: user.id,
        eventType: existed ? 'connection' : 'signup',
        sessionId: session.id,
      },
    });
  });
  return { token, userId: user.id, isNew: !existed };
}

export async function userFromToken(token: string | undefined) {
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!s || s.expiresAt.getTime() < Date.now()) return null;
  return s.user;
}
