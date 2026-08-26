-- Make revenue arithmetic explicit and auditable at sync time instead of
-- re-deriving it in every query:
--   netCents  = amount - refunded (what we actually kept)
--   isRevenue = false for failed/void charge attempts, true for money captured
--               (succeeded, partially_refunded, and refunded — the last nets to 0)
ALTER TABLE "SngPayment" ADD COLUMN IF NOT EXISTS "netCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SngPayment" ADD COLUMN IF NOT EXISTS "isRevenue" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS "SngPayment_isRevenue_idx" ON "SngPayment" ("isRevenue");
