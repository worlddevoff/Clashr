-- Fresh Clashr schema (Prisma dump). RLS on; no anon write policies.
-- The Node server uses DATABASE_URL (postgres). Do not grant table writes to anon.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "players" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '🗼',
    "color" TEXT NOT NULL DEFAULT '#22e5ff',
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "xp_to_next" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "players_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sessions" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "auth_nonces" (
    "nonce" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "auth_nonces_pkey" PRIMARY KEY ("nonce")
);

CREATE TABLE IF NOT EXISTS "credit_accounts" (
    "user_id" TEXT NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE IF NOT EXISTS "ledger_entries" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "match_id" TEXT,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "matches" (
    "id" TEXT NOT NULL,
    "game_slug" TEXT NOT NULL DEFAULT 'tower',
    "seed" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'live',
    "practice" BOOLEAN NOT NULL DEFAULT false,
    "winner_id" TEXT,
    "prize" INTEGER NOT NULL DEFAULT 0,
    "gross" INTEGER NOT NULL DEFAULT 0,
    "platform_fee" INTEGER NOT NULL DEFAULT 0,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "escrow_status" TEXT NOT NULL DEFAULT 'not_required',
    "escrow_party_id" TEXT,
    "escrow_winner_address" TEXT,
    "escrow_house" BOOLEAN NOT NULL DEFAULT false,
    "escrow_signature" TEXT,
    "escrow_attempts" INTEGER NOT NULL DEFAULT 0,
    "escrow_error" TEXT,
    "escrow_submitted_at" TIMESTAMP(3),
    "escrow_settled_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    CONSTRAINT "matches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "matches_escrow_status_check"
      CHECK ("escrow_status" IN ('not_required', 'pending', 'submitted', 'confirmed', 'failed'))
);

CREATE TABLE IF NOT EXISTS "match_participants" (
    "match_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "is_bot" BOOLEAN NOT NULL DEFAULT false,
    "placement" INTEGER,
    "floors_reached" INTEGER NOT NULL DEFAULT 1,
    "shoves" INTEGER NOT NULL DEFAULT 0,
    "falls_survived" INTEGER NOT NULL DEFAULT 0,
    "credits_won" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "match_participants_pkey" PRIMARY KEY ("match_id","user_id")
);

CREATE TABLE IF NOT EXISTS "replay_events" (
    "id" UUID NOT NULL,
    "match_id" TEXT NOT NULL,
    "t" DOUBLE PRECISION NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "replay_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "match_moments" (
    "id" UUID NOT NULL,
    "match_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "player" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "stat" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match_moments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "leaderboard" (
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "games_played" INTEGER NOT NULL DEFAULT 0,
    "biggest_win" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leaderboard_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE IF NOT EXISTS "parties" (
    "id" TEXT NOT NULL,
    "game_slug" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "entry" INTEGER NOT NULL DEFAULT 0,
    "entry_lamports" BIGINT,
    "host_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "escrow_pda" TEXT,
    "escrow_deposits" JSONB NOT NULL DEFAULT '[]',
    "game_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "parties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "party_members" (
    "party_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatar" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "is_host" BOOLEAN NOT NULL DEFAULT false,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "party_members_pkey" PRIMARY KEY ("party_id","user_id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sessions_nonce_key" ON "sessions"("nonce");
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_key" ON "sessions"("token");
CREATE INDEX IF NOT EXISTS "sessions_user_id_idx" ON "sessions"("user_id");
CREATE INDEX IF NOT EXISTS "sessions_expires_at_idx" ON "sessions"("expires_at");
CREATE INDEX IF NOT EXISTS "auth_nonces_address_idx" ON "auth_nonces"("address");
CREATE INDEX IF NOT EXISTS "ledger_entries_user_id_created_at_idx" ON "ledger_entries"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "ledger_entries_match_id_idx" ON "ledger_entries"("match_id");
CREATE INDEX IF NOT EXISTS "matches_game_slug_started_at_idx" ON "matches"("game_slug", "started_at");
CREATE INDEX IF NOT EXISTS "matches_winner_id_idx" ON "matches"("winner_id");
CREATE INDEX IF NOT EXISTS "matches_escrow_status_idx" ON "matches"("escrow_status");
CREATE INDEX IF NOT EXISTS "match_participants_user_id_idx" ON "match_participants"("user_id");
CREATE INDEX IF NOT EXISTS "replay_events_match_id_t_idx" ON "replay_events"("match_id", "t");
CREATE INDEX IF NOT EXISTS "match_moments_match_id_idx" ON "match_moments"("match_id");
CREATE INDEX IF NOT EXISTS "match_moments_created_at_idx" ON "match_moments"("created_at");
CREATE INDEX IF NOT EXISTS "leaderboard_wins_biggest_win_idx" ON "leaderboard"("wins", "biggest_win");
CREATE INDEX IF NOT EXISTS "parties_visibility_status_created_at_idx" ON "parties"("visibility", "status", "created_at");
CREATE INDEX IF NOT EXISTS "parties_host_id_idx" ON "parties"("host_id");
CREATE INDEX IF NOT EXISTS "party_members_user_id_idx" ON "party_members"("user_id");

ALTER TABLE "sessions" DROP CONSTRAINT IF EXISTS "sessions_user_id_fkey";
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "credit_accounts" DROP CONSTRAINT IF EXISTS "credit_accounts_user_id_fkey";
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ledger_entries" DROP CONSTRAINT IF EXISTS "ledger_entries_user_id_fkey";
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_participants" DROP CONSTRAINT IF EXISTS "match_participants_match_id_fkey";
ALTER TABLE "match_participants" ADD CONSTRAINT "match_participants_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "replay_events" DROP CONSTRAINT IF EXISTS "replay_events_match_id_fkey";
ALTER TABLE "replay_events" ADD CONSTRAINT "replay_events_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_moments" DROP CONSTRAINT IF EXISTS "match_moments_match_id_fkey";
ALTER TABLE "match_moments" ADD CONSTRAINT "match_moments_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leaderboard" DROP CONSTRAINT IF EXISTS "leaderboard_user_id_fkey";
ALTER TABLE "leaderboard" ADD CONSTRAINT "leaderboard_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "parties" DROP CONSTRAINT IF EXISTS "parties_host_id_fkey";
ALTER TABLE "parties" ADD CONSTRAINT "parties_host_id_fkey" FOREIGN KEY ("host_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "party_members" DROP CONSTRAINT IF EXISTS "party_members_party_id_fkey";
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_party_id_fkey" FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "party_members" DROP CONSTRAINT IF EXISTS "party_members_user_id_fkey";
ALTER TABLE "party_members" ADD CONSTRAINT "party_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE replay_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE party_members ENABLE ROW LEVEL SECURITY;
