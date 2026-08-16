FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

COPY package.json package-lock.json ./
COPY server/prisma ./server/prisma
RUN npm ci

COPY . .

# Railway passes service variables as build args so Vite can bake VITE_* into the SPA.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_TREASURY_WALLET
ARG VITE_ORACLE_WALLET
ARG VITE_ESCROW_PROGRAM_ID
ARG VITE_SOLANA_CLUSTER
ARG VITE_API_ORIGIN
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_TREASURY_WALLET=$VITE_TREASURY_WALLET \
    VITE_ORACLE_WALLET=$VITE_ORACLE_WALLET \
    VITE_ESCROW_PROGRAM_ID=$VITE_ESCROW_PROGRAM_ID \
    VITE_SOLANA_CLUSTER=$VITE_SOLANA_CLUSTER \
    VITE_API_ORIGIN=$VITE_API_ORIGIN

RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_ANON_KEY" \
    || (echo "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required at build time" >&2; exit 1)

RUN npx prisma generate --schema server/prisma/schema.prisma \
    && npm run build

ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --schema server/prisma/schema.prisma && npm run start"]
