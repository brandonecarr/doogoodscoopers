-- Returning-lead surfacing: track the last time a lead did something
-- (created, or re-submitted a form). Lists sort by this so a re-engaged
-- lead floats to the top even though consolidation backdates createdAt.
ALTER TABLE "AdLead" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);
UPDATE "AdLead" SET "lastActivityAt" = "createdAt" WHERE "lastActivityAt" IS NULL;
ALTER TABLE "AdLead" ALTER COLUMN "lastActivityAt" SET DEFAULT now();
CREATE INDEX IF NOT EXISTS "AdLead_lastActivityAt_idx" ON "AdLead" ("lastActivityAt");

ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);
UPDATE "QuoteLead" SET "lastActivityAt" = "createdAt" WHERE "lastActivityAt" IS NULL;
ALTER TABLE "QuoteLead" ALTER COLUMN "lastActivityAt" SET DEFAULT now();
CREATE INDEX IF NOT EXISTS "QuoteLead_lastActivityAt_idx" ON "QuoteLead" ("lastActivityAt");
