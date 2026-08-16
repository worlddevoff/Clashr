/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TREASURY_WALLET?: string;
  readonly VITE_ORACLE_WALLET?: string;
  readonly VITE_SOLANA_CLUSTER?: string;
  readonly VITE_SOLANA_RPC?: string;
  readonly VITE_ESCROW_PROGRAM_ID?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_ENABLE_SOL_POTS?: string;
}
