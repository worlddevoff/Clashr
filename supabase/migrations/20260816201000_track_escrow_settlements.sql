ALTER TABLE "matches"
  ADD COLUMN IF NOT EXISTS "escrow_status" TEXT NOT NULL DEFAULT 'not_required',
  ADD COLUMN IF NOT EXISTS "escrow_party_id" TEXT,
  ADD COLUMN IF NOT EXISTS "escrow_winner_address" TEXT,
  ADD COLUMN IF NOT EXISTS "escrow_house" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "escrow_signature" TEXT,
  ADD COLUMN IF NOT EXISTS "escrow_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "escrow_error" TEXT,
  ADD COLUMN IF NOT EXISTS "escrow_submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "escrow_settled_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "matches_escrow_status_idx" ON "matches"("escrow_status");

ALTER TABLE "matches"
  DROP CONSTRAINT IF EXISTS "matches_escrow_status_check";
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_escrow_status_check"
  CHECK ("escrow_status" IN ('not_required', 'pending', 'submitted', 'confirmed', 'failed'));
