# Arcade match escrow

Per-match SOL pot: each human deposits entry into a PDA. When the match ends the **house oracle** settles — winner receives pot − 5% fee, or the treasury keeps the pot if a bot wins. The host cannot settle.

Two wallets:

- **Treasury** (`TREASURY_WALLET` / `VITE_TREASURY_WALLET`) — public receive address for the 5% fee and bot-win pots. You keep this key offline.
- **Oracle** (`HOUSE_SECRET_KEY`) — hot signer on the Node server. Pays transaction fees and receives PDA rent on close. Its pubkey is recorded on the match account at create.

The SPA turns pots on from `GET /api/config` once the oracle key is present and this program is deployed.

## Deploy

Requires [Solana CLI](https://solana.com/docs/intro/installation) and a funded keypair on the same cluster as `VITE_SOLANA_CLUSTER`.

```bash
cd solana/arcade-escrow
cargo build-sbf
solana program deploy target/deploy/arcade_escrow.so \
  --program-id keys/arcade_escrow-keypair.json
```

Program id (this keypair): `6N6QkDcBeH5nmMakCDYegU9kCJqRei5gLKVK4PDAY2yL`

Set in the app `.env`:

```
VITE_ESCROW_PROGRAM_ID=6N6QkDcBeH5nmMakCDYegU9kCJqRei5gLKVK4PDAY2yL
```

Account layout magic is `ARCESC02`. Redeploy this program before creating new pots.
