# Clashr: Crypto PvP Games & Online Gaming

Crypto PvP front end — multiplayer **Bomb Party** plus **Tower**.

## Games

- **Bomb Party** — party matches tick on the Node server. Solo vs bots stays local.
- **CLASHR: TOWER** — vertical PvP climbing. Quick match and parties tick on the Node server. Demo credits always; SOL pots when the house oracle is live.

## Stack

- Vite + React + TypeScript + React Three Fiber (Tower)
- Authoritative match server: Node, Express, WebSockets, Prisma/Postgres
- Tailwind CSS, React Router, Framer Motion

## Scripts

```bash
npm install
npx prisma db push --schema server/prisma/schema.prisma
npm run dev      # client + API/WS server (http://localhost:5173)
npm test
npm run build
npm start        # production Node (serves /api, /ws, and dist/ if present)
```

Local Vite proxies `/api` and `/ws` to `http://127.0.0.1:3001`.

## Production (Railway)

One service runs the website, `/api`, and `/ws`. Do not put the match server on Vercel.

1. [railway.app](https://railway.app) → New Project → Deploy from GitHub → `worlddevoff/Clashr`.
2. Variables (mark `VITE_*` available at **build** time):

   - `DATABASE_URL` — Supabase pooler URI, port `6543`, `?pgbouncer=true`
   - `DIRECT_URL` — Supabase URI, port `5432`
   - `NODE_ENV=production`
   - `VITE_SUPABASE_URL=https://cbfyrkxzgtxoypewdouf.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — publishable / anon key (not `service_role`)

3. Settings → Networking → Generate domain. Leave `VITE_API_ORIGIN` empty (same host).
4. Redeploy after adding variables so the frontend rebuilds.

`PORT` is set by Railway. Same-origin play does not need `CORS_ORIGINS`.

- **SOL pots** turn on when `HOUSE_SECRET_KEY` (house oracle signer) is set **and** `solana/arcade-escrow` is deployed on the cluster in `VITE_SOLANA_CLUSTER` (start on **devnet**). The SPA reads `/api/config` — do not set `VITE_ENABLE_SOL_POTS`. Set `TREASURY_WALLET` / `VITE_TREASURY_WALLET` to the public fee-receive address (5% + bot-win pots). That address does **not** need to match the oracle. Also set `ESCROW_PROGRAM_ID` / `VITE_ESCROW_PROGRAM_ID`. Optional `SOLANA_RPC` (Node only, never `VITE_*`) is used by `POST /api/solana/rpc` so wallets never hit public Devnet from the browser.
- Smoke-test two wallets on devnet (create party → both deposit → play → winner paid, host cannot settle) before mainnet.
- Party create/join/start goes through session-authenticated `/api/parties`.
- Terms, privacy, and an 18+ gate live at `/terms`, `/privacy`, `/responsible-play`.

## Supabase

Project: [`cbfyrkxzgtxoypewdouf`](https://supabase.com/dashboard/project/cbfyrkxzgtxoypewdouf)

Postgres holds users, sessions, demo-credit ledgers, matches, parties, and the leaderboard. The Node server talks to it through Prisma.

1. Open **Project Settings → Database → Connection string**.
2. Copy the **URI** for the session pooler (port `6543`) into `DATABASE_URL` and the session/direct URI (port `5432`) into `DIRECT_URL`.
3. Open **Project Settings → API** and set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
4. From the repo root:

```bash
npx prisma generate --schema server/prisma/schema.prisma
npx prisma db push --schema server/prisma/schema.prisma
```

A fresh project can apply `supabase/migrations/20260815131600_init_clashr_core.sql`.

## Auth

Players **connect a Solana wallet** and sign a **server nonce**. Profile, XP, and the session live in Postgres. Tower balances are **virtual demo credits** keyed to the same wallet.

## Notes

Tower prize math for a 10-player match: 10 × 100 = 1,000 demo credits, 5% simulated platform fee (50), 950 to the winner. Labeled as having **no real-world value**.
