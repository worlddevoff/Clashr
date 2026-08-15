# Clashr: Crypto PvP Games & Online Gaming

Crypto PvP front end — multiplayer **Bomb Party** plus **Tower**.

## Games

- **Bomb Party** — party matches tick on the Node server. Solo vs bots stays local.
- **CLASHR: TOWER** — vertical PvP climbing. Quick match and parties tick on the Node server. Virtual/demo credits only.

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

Local Vite proxies `/api` and `/ws` to `http://127.0.0.1:3001`. In production set `VITE_API_ORIGIN` at **build** time if the SPA and Node are on different hosts.

## Production

- **SPA:** Vercel (`vercel.json` SPA fallback). Bake `VITE_*` at build time.
- **API + WebSocket:** Docker/`npm start` on Fly, Railway, or a VM. Needs `DATABASE_URL`, `DIRECT_URL`, `PORT`, and `CORS_ORIGINS`.
- **SOL pots:** off unless `VITE_ENABLE_SOL_POTS=1` **and** `HOUSE_SECRET_KEY` is the treasury keypair. Redeploy `solana/arcade-escrow` so settle requires that oracle. Then smoke-test two wallets on **devnet** before mainnet.
- Party create/join/start goes through session-authenticated `/api/parties`.

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
