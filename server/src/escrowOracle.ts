import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import bs58 from 'bs58';

const SEED = Buffer.from('arcade-match');
const DEFAULT_PROGRAM = '96kU3yLXf5agsoBGzTCQvtYxqAfm4vQV1XdZYKh95512';
const DEFAULT_TREASURY = 'FhBqhrNJ4VNEG9JANerxgKt1L8hYhugXCgXrefqSBw3j';

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
  return !!houseKeypair();
}

function partyIdSeed(partyId: string): Buffer {
  const buf = Buffer.alloc(32);
  const s = partyId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  buf.write(s, 0, s.length, 'utf8');
  return buf;
}

function programId(): PublicKey {
  return new PublicKey(process.env.ESCROW_PROGRAM_ID || process.env.VITE_ESCROW_PROGRAM_ID || DEFAULT_PROGRAM);
}

function treasury(): PublicKey {
  return new PublicKey(process.env.TREASURY_WALLET || process.env.VITE_TREASURY_WALLET || DEFAULT_TREASURY);
}

function rpcUrl(): string {
  return (
    process.env.SOLANA_RPC ||
    process.env.VITE_SOLANA_RPC ||
    (process.env.VITE_SOLANA_CLUSTER === 'devnet'
      ? 'https://api.devnet.solana.com'
      : 'https://solana-rpc.publicnode.com')
  );
}

/** Pays the locked pot from the house/oracle key after an authoritative match_end. */
export async function settleEscrowAsHouse(opts: {
  partyId: string;
  winnerAddress: string | null;
  house: boolean;
}): Promise<string | null> {
  const oracle = houseKeypair();
  if (!oracle) return null;
  const program = programId();
  const [pda] = PublicKey.findProgramAddressSync([SEED, partyIdSeed(opts.partyId)], program);
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
  data[33] = house ? 1 : 0;
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
}
