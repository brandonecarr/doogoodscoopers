-- Quote recovery: resume links for Sweep&Go quote leads who never finished signing up.
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "sngEntryId" TEXT;
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "marketingAllowed" BOOLEAN;
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "resumeCode" TEXT;
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "resumeDisabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "resumeOpenedAt" TIMESTAMP(3);
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "resumeLastOpenedAt" TIMESTAMP(3);
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "resumeOpenCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "resumeChannel" TEXT;
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "QuoteLead_resumeCode_key" ON "QuoteLead"("resumeCode");
CREATE INDEX IF NOT EXISTS "QuoteLead_sngEntryId_idx" ON "QuoteLead"("sngEntryId");
