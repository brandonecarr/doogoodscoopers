-- Per-customer review tracking (local only; never synced to Sweep&Go).
-- Values: NO_REVIEW | REQUEST_SENT | REVIEW_COMPLETE.
ALTER TABLE "SweepandgoCustomer"
  ADD COLUMN IF NOT EXISTS "reviewStatus" TEXT NOT NULL DEFAULT 'NO_REVIEW';

CREATE INDEX IF NOT EXISTS "SweepandgoCustomer_reviewStatus_idx"
  ON "SweepandgoCustomer" ("reviewStatus");
