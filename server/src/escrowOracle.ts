import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';

const SEED = Buffer.from('arcade-match');
const ESCROW_MAGIC = 'ARCESC02';
const ESCROW_ACCOUNT_SIZE = 794;
const DEFAULT_PROGRAM = '6N6QkDcBeH5nmMakCDYegU9kCJqRei5gLKVK4PDAY2yL';
/** 5% fee / bot-win destination. Public receive address only — never the house signer. */
const DEFAULT_TREASURY = '259nG2nNP8GjCKRYqrcpsEJ14qfrra5yabjpU6axs7We';

let potsReady = false;
let potsReason = 'starting';
let probing: Promise<boolean> | null = null;

export function houseKeypair(): Keypair | null {
  const raw = process.env.HOUSE_SECRET_KEY?.trim();
  if (!raw) return null;
  try {
    if (raw.startsWith('[')) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw) as number[]));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch (err) {
    console.error('HOUSE_SECRET_KEY is invalid', err instanceof Error ? err.message : err);
    return null;
  }
}

export function houseCanSettle(): boolean {
  return potsReady;
}

export function potsStatus(): { solPots: boolean; reason: string } {
  return { solPots: potsReady, reason: potsReason };
}

export function partyIdSeed(partyId: string): Buffer {
  const buf = Buffer.alloc(32);
  const s = partyId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  buf.write(s, 0, s.length, 'utf8');
  return buf;
}

export function programId(): PublicKey {
  return new PublicKey(process.env.ESCROW_PROGRAM_ID || process.env.VITE_ESCROW_PROGRAM_ID || DEFAULT_PROGRAM);
}

export function treasury(): PublicKey {
  return new PublicKey(process.env.TREASURY_WALLET || process.env.VITE_TREASURY_WALLET || DEFAULT_TREASURY);
}

/** Pubkey of HOUSE_SECRET_KEY — signs settle. Not the fee wallet. */
export function oraclePubkey(): string | null {
  return houseKeypair()?.publicKey.toBase58() ?? null;
}

export function clusterName(): string {
  return process.env.VITE_SOLANA_CLUSTER?.trim() || process.env.SOLANA_CLUSTER?.trim() || 'devnet';
}

export function rpcUrl(): string {
  const custom = process.env.SOLANA_RPC;
  if (
    custom &&
    !/api\.(devnet|testnet|mainnet-beta)\.solana\.com/i.test(custom) &&
    !/ankr\.com/i.test(custom) &&
    !/drpc\.org/i.test(custom)
  ) {
    return custom;
  }
  return (
    (clusterName() === 'devnet'
      ? 'https://solana-devnet.api.onfinality.io/public'
      : clusterName() === 'testnet'
        ? 'https://api.testnet.solana.com'
        : 'https://solana-rpc.publicnode.com')
  );
}

export async function refreshPotsReady(): Promise<boolean> {
  if (probing) return probing;
  probing = (async () => {
    const oracle = houseKeypair();
    if (!oracle) {
      potsReady = false;
      potsReason = 'no_house_key';
      return false;
    }
    try {
      const info = await new Connection(rpcUrl(), 'confirmed').getAccountInfo(programId());
      if (!info?.executable) {
        potsReady = false;
        potsReason = 'program_missing';
        return false;
      }
    } catch (err) {
      potsReady = false;
      potsReason = 'rpc_error';
      console.error('escrow program probe failed', err instanceof Error ? err.message : err);
      return false;
    }
    potsReady = true;
    potsReason = 'ok';
    return true;
  })();
  try {
    return await probing;
  } finally {
    probing = null;
  }
}

function partyPda(partyId: string, program: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync([SEED, partyIdSeed(partyId)], program);
  return pda;
}

export interface EscrowState {
  pda: string;
  entryLamports: number;
  status: number;
  players: string[];
}

export async function fetchEscrowState(partyId: string): Promise<EscrowState | null> {
  const program = programId();
  const pda = partyPda(partyId, program);
  const info = await new Connection(rpcUrl(), 'confirmed').getAccountInfo(pda, 'confirmed');
  if (!info || !info.owner.equals(program) || info.data.length < ESCROW_ACCOUNT_SIZE) return null;
  const data = Buffer.from(info.data);
  if (data.subarray(0, 8).toString() !== ESCROW_MAGIC) return null;

  const playerCount = data[147] ?? 0;
  const capacity = data[146] ?? 0;
  if (playerCount > capacity || 154 + playerCount * 32 > data.length) return null;
  const players: string[] = [];
  for (let i = 0; i < playerCount; i++) {
    const start = 154 + i * 32;
    players.push(new PublicKey(data.subarray(start, start + 32)).toBase58());
  }
  return {
    pda: pda.toBase58(),
    entryLamports: Number(data.readBigUInt64LE(136)),
    status: data[148] ?? 0,
    players,
  };
}

/** Pays the locked pot from the house/oracle key after an authoritative match_end. */
export async function settleEscrowAsHouse(opts: {
  partyId: string;
  winnerAddress: string | null;
  house: boolean;
}): Promise<string | null> {
  const oracle = houseKeypair();
  if (!oracle || !potsReady) return null;
  const program = programId();
  const pda = partyPda(opts.partyId, program);
  const treasuryPk = treasury();
  const house = opts.house || !opts.winnerAddress;
  let winner: PublicKey;
  try {
    winner = house ? treasuryPk : new PublicKey(opts.winnerAddress as string);
  } catch {
    winner = treasuryPk;
  }
  const data = Buffer.alloc(1 + 32 + 1);
  data[0] = 4;
  winner.toBuffer().copy(data, 1);
  data[33] = house || winner.equals(treasuryPk) ? 1 : 0;
  const ix = new TransactionInstruction({
    programId: program,
    keys: [
      { pubkey: oracle.publicKey, isSigner: true, isWritable: true },
      { pubkey: pda, isSigner: false, isWritable: true },
      { pubkey: treasuryPk, isSigner: false, isWritable: true },
      { pubkey: winner, isSigner: false, isWritable: true },
    ],
    data,
  });
  const connection = new Connection(rpcUrl(), 'confirmed');
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const tx = new Transaction({
        feePayer: oracle.publicKey,
        blockhash,
        lastValidBlockHeight,
      }).add(ix);
      tx.sign(oracle);
      const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
      return sig;
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('escrow settle failed');
}
