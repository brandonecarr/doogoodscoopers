-- Sweep&Go payments carry no id, so a resumable/cumulative sync needs a natural
-- key to upsert on (date + client + amounts + status + invoice description).
-- Without this the sync had to be all-or-nothing, which the API's rate limit
-- (HTTP 429) makes impossible to complete in one invocation.
ALTER TABLE "SngPayment" ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;
DELETE FROM "SngPayment"; -- stale pre-key rows; refilled by the next sync
ALTER TABLE "SngPayment" ALTER COLUMN "dedupeKey" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "SngPayment_dedupeKey_key" ON "SngPayment" ("dedupeKey");
