# Arcade match escrow

Per-match SOL pot: each human deposits entry into a PDA. When the match ends the host settles — winner receives pot − 5% fee, or the treasury keeps the pot if a bot wins.

## Deploy

Requires [Solana CLI](https://solana.com/docs/intro/installation) and a funded keypair on the same cluster as `VITE_SOLANA_CLUSTER`.

```bash
cd solana/arcade-escrow
cargo build-sbf
solana program deploy target/deploy/arcade_escrow.so \
  --program-id keys/arcade_escrow-keypair.json
```

Program id (this keypair): `96kU3yLXf5agsoBGzTCQvtYxqAfm4vQV1XdZYKh95512`

Set in the app `.env`:

```
VITE_ESCROW_PROGRAM_ID=96kU3yLXf5agsoBGzTCQvtYxqAfm4vQV1XdZYKh95512
```

Treasury must match `VITE_TREASURY_WALLET` (pack purchases use the same address).
