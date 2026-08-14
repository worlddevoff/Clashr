# Clashr: Crypto PvP Games & Online Gaming

Crypto PvP front end — multiplayer **Bomb Party** plus **Tower**.

## Games

- **Bomb Party** — existing party/escrow flow
- **CLASHR: TOWER** — vertical PvP climbing. Virtual/demo credits only. No real-money deposits, crypto, or withdrawals.

## Stack

- Vite + React + TypeScript + React Three Fiber (Tower)
- Authoritative Tower server: Node, Express, WebSockets, Prisma/SQLite
- Tailwind CSS, React Router, Framer Motion

## Scripts

```bash
npm install
npx prisma db push --schema server/prisma/schema.prisma
npm run dev      # client + tower server (http://localhost:5173)
npm test
npm run build
```

Tower server: `http://localhost:3001` (proxied from Vite as `/api` and `/ws`).

## Auth

Players **connect a Solana wallet** and sign a message. Bomb Party pots can use on-chain SOL escrow. Tower balances are **virtual demo credits** keyed to the same wallet.

## Notes

Tower prize math for a 10-player match: 10 × 100 = 1,000 demo credits, 5% simulated platform fee (50), 950 to the winner. Labeled as having **no real-world value**.
