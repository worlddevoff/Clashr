import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Buffer } from 'buffer';
import { getSolanaProvider } from './wallet';
import { getTreasuryAddress } from './solanaConfig';
import { friendlyRpcError, rpc, sendSignedTransaction } from './solanaRpc';

/** Default program id from `solana/arcade-escrow/keys`. */
export const DEFAULT_ESCROW_PROGRAM_ID = '96kU3yLXf5agsoBGzTCQvtYxqAfm4vQV1XdZYKh95512';

/** Default party stake. */
export const ENTRY_LAMPORTS = 10_000_000;
export const ESCROW_FEE_BPS = 500;
export const ENTRY_SOL = ENTRY_LAMPORTS / LAMPORTS_PER_SOL;
export const STAKE_PRESETS_SOL = [0.01, 0.025, 0.05, 0.1, 0.25] as const;
export const MIN_STAKE_LAMPORTS = 1_000_000; // 0.001 SOL
export const MAX_STAKE_LAMPORTS = 2 * LAMPORTS_PER_SOL;

export function solToLamports(sol: number): number {
  return Math.round(sol * LAMPORTS_PER_SOL);
}

export function clampStakeLamports(lamports: number): number {
  if (!Number.isFinite(lamports) || lamports <= 0) return ENTRY_LAMPORTS;
  return Math.min(MAX_STAKE_LAMPORTS, Math.max(MIN_STAKE_LAMPORTS, Math.round(lamports)));
}

export function parseStakeLamports(raw: string | null | undefined, fallback = ENTRY_LAMPORTS): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return clampStakeLamports(n);
}

const LAST_STAKE_SOL_KEY = 'arcade.lastStakeSol';

export function lamportsToSol(lamports: number): number {
  return clampStakeLamports(lamports) / LAMPORTS_PER_SOL;
}

export function loadLastStakeSol(): number {
  try {
    const n = Number(localStorage.getItem(LAST_STAKE_SOL_KEY));
    if (Number.isFinite(n) && n > 0) return lamportsToSol(solToLamports(n));
  } catch {
    /* ignore */
  }
  return ENTRY_SOL;
}

export function saveLastStakeSol(sol: number): void {
  try {
    localStorage.setItem(LAST_STAKE_SOL_KEY, String(lamportsToSol(solToLamports(sol))));
  } catch {
    /* ignore */
  }
}

const SEED = Buffer.from('arcade-match');
const MATCH_SIZE = 762;

export function getEscrowProgramId(): PublicKey {
  const id = import.meta.env.VITE_ESCROW_PROGRAM_ID?.trim() || DEFAULT_ESCROW_PROGRAM_ID;
  return new PublicKey(id);
}

export function partyIdSeed(partyId: string): Buffer {
  const buf = Buffer.alloc(32);
  const s = partyId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  buf.write(s, 0, s.length, 'utf8');
  return buf;
}

export function matchPda(partyId: string, programId = getEscrowProgramId()): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([SEED, partyIdSeed(partyId)], programId);
}

export function computeEscrowPool(
  humanCount: number,
  entryLamports: number = ENTRY_LAMPORTS,
): {
  gross: number;
  platformFee: number;
  prizePool: number;
} {
  const stake = clampStakeLamports(entryLamports);
  const gross = (humanCount * stake) / LAMPORTS_PER_SOL;
  const platformFee = (gross * ESCROW_FEE_BPS) / 10_000;
  const prizePool = humanCount < 2 ? 0 : gross - platformFee;
  return { gross, platformFee, prizePool };
}

export interface EscrowAccount {
  pda: string;
  authority: string;
  treasury: string;
  entryLamports: number;
  feeBps: number;
  capacity: number;
  playerCount: number;
  status: number;
  players: string[];
}

function decodeEscrow(pda: string, raw: Buffer): EscrowAccount | null {
  if (raw.length < MATCH_SIZE) return null;
  if (raw.subarray(0, 8).toString() !== 'ARCESC01') return null;
  const count = raw[115];
  const players: string[] = [];
  for (let i = 0; i < count; i++) {
    const start = 122 + i * 32;
    players.push(new PublicKey(raw.subarray(start, start + 32)).toBase58());
  }
  return {
    pda,
    authority: new PublicKey(raw.subarray(8, 40)).toBase58(),
    treasury: new PublicKey(raw.subarray(40, 72)).toBase58(),
    entryLamports: Number(raw.readBigUInt64LE(104)),
    feeBps: raw.readUInt16LE(112),
    capacity: raw[114],
    playerCount: count,
    status: raw[116],
    players,
  };
}

export async function fetchEscrow(partyId: string): Promise<EscrowAccount | null> {
  const [pda] = matchPda(partyId);
  const info = await rpc<{ value: { data: [string, string] } | null }>('getAccountInfo', [
    pda.toBase58(),
    { encoding: 'base64', commitment: 'confirmed' },
  ]);
  if (!info.value?.data?.[0]) return null;
  return decodeEscrow(pda.toBase58(), Buffer.from(info.value.data[0], 'base64'));
}

async function latestBlockhash(): Promise<string> {
  const latest = await rpc<{ value: { blockhash: string } }>('getLatestBlockhash', [
    { commitment: 'confirmed' },
  ]);
  return latest.value.blockhash;
}

function payer(): PublicKey {
  const provider = getSolanaProvider();
  const pk = provider?.publicKey?.toString();
  if (!pk) throw new Error('Connect your Solana wallet.');
  return new PublicKey(pk);
}

function ix(data: Buffer, keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[]) {
  return new TransactionInstruction({
    programId: getEscrowProgramId(),
    keys,
    data,
  });
}

function writeU64LE(buf: Buffer, offset: number, value: number): void {
  const big = BigInt(Math.max(0, Math.round(value)));
  buf.writeUInt32LE(Number(big & 0xffffffffn), offset);
  buf.writeUInt32LE(Number(big >> 32n), offset + 4);
}

function buildCreateData(partyId: string, capacity: number, entryLamports: number): Buffer {
  const data = Buffer.alloc(1 + 8 + 1 + 2 + 32);
  data[0] = 0;
  writeU64LE(data, 1, clampStakeLamports(entryLamports));
  data[9] = capacity;
  data.writeUInt16LE(ESCROW_FEE_BPS, 10);
  partyIdSeed(partyId).copy(data, 12);
  return data;
}

function joinIx(player: PublicKey, pda: PublicKey) {
  return ix(Buffer.from([1]), [
    { pubkey: player, isSigner: true, isWritable: true },
    { pubkey: pda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]);
}

export async function createAndJoinEscrow(
  partyId: string,
  capacity: number,
  entryLamports: number = ENTRY_LAMPORTS,
): Promise<{ pda: string; signature: string }> {
  try {
    const existing = await fetchEscrow(partyId);
    const host = payer();
    const [pda] = matchPda(partyId);
    if (existing) {
      if (!existing.players.includes(host.toBase58())) {
        const sig = await joinEscrow(partyId);
        return { pda: pda.toBase58(), signature: sig };
      }
      return { pda: pda.toBase58(), signature: '' };
    }

    const treasury = new PublicKey(getTreasuryAddress());
    const tx = new Transaction({ feePayer: host, recentBlockhash: await latestBlockhash() }).add(
      ix(buildCreateData(partyId, capacity, entryLamports), [
        { pubkey: host, isSigner: true, isWritable: true },
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ]),
      joinIx(host, pda),
    );
    const signature = await sendSignedTransaction(tx);
    return { pda: pda.toBase58(), signature };
  } catch (e) {
    throw new Error(friendlyRpcError(e));
  }
}

export async function joinEscrow(partyId: string): Promise<string> {
  try {
    const player = payer();
    const [pda] = matchPda(partyId);
    const existing = await fetchEscrow(partyId);
    if (existing?.players.includes(player.toBase58())) return '';
    const tx = new Transaction({ feePayer: player, recentBlockhash: await latestBlockhash() }).add(
      joinIx(player, pda),
    );
    return await sendSignedTransaction(tx);
  } catch (e) {
    throw new Error(friendlyRpcError(e));
  }
}

export async function withdrawEscrow(partyId: string): Promise<string> {
  try {
    const player = payer();
    const [pda] = matchPda(partyId);
    const existing = await fetchEscrow(partyId);
    if (!existing?.players.includes(player.toBase58())) return '';
    const tx = new Transaction({ feePayer: player, recentBlockhash: await latestBlockhash() }).add(
      ix(Buffer.from([2]), [
        { pubkey: player, isSigner: true, isWritable: true },
        { pubkey: pda, isSigner: false, isWritable: true },
      ]),
    );
    return await sendSignedTransaction(tx);
  } catch (e) {
    throw new Error(friendlyRpcError(e));
  }
}

export async function lockEscrow(partyId: string): Promise<string> {
  try {
    const host = payer();
    const [pda] = matchPda(partyId);
    const tx = new Transaction({ feePayer: host, recentBlockhash: await latestBlockhash() }).add(
      ix(Buffer.from([3]), [
        { pubkey: host, isSigner: true, isWritable: false },
        { pubkey: pda, isSigner: false, isWritable: true },
      ]),
    );
    return await sendSignedTransaction(tx);
  } catch (e) {
    throw new Error(friendlyRpcError(e));
  }
}

export async function settleEscrow(
  partyId: string,
  opts: { winnerAddress: string | null; house: boolean },
): Promise<string> {
  try {
    const host = payer();
    const [pda] = matchPda(partyId);
    const treasury = new PublicKey(getTreasuryAddress());
    const house = opts.house || !opts.winnerAddress;
    let winner: PublicKey;
    try {
      winner = house ? host : new PublicKey(opts.winnerAddress as string);
    } catch {
      winner = host;
    }
    const data = Buffer.alloc(1 + 32 + 1);
    data[0] = 4;
    winner.toBuffer().copy(data, 1);
    if (house) {
      host.toBuffer().copy(data, 1);
    }
    data[33] = house ? 1 : 0;
    const tx = new Transaction({ feePayer: host, recentBlockhash: await latestBlockhash() }).add(
      ix(data, [
        { pubkey: host, isSigner: true, isWritable: true },
        { pubkey: pda, isSigner: false, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: winner, isSigner: false, isWritable: true },
      ]),
    );
    return await sendSignedTransaction(tx);
  } catch (e) {
    throw new Error(friendlyRpcError(e));
  }
}
