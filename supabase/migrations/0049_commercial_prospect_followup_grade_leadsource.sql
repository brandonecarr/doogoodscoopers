-- Call-list prospects get the same working tools as leads: status, follow-up date,
-- grade, and a communication log (LeadUpdate rows under a new LeadSource value).
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'COMMERCIAL_PROSPECT';
ALTER TABLE "CommercialProspect" ADD COLUMN IF NOT EXISTS "followupDate" TIMESTAMP(3);
ALTER TABLE "CommercialProspect" ADD COLUMN IF NOT EXISTS "grade" TEXT;
CREATE INDEX IF NOT EXISTS "CommercialProspect_followupDate_idx" ON "CommercialProspect"("followupDate");
