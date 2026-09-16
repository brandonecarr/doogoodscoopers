-- Meta Lead Ads leadgen id, so a redelivered webhook can't create a duplicate lead.
ALTER TABLE "AdLead" ADD COLUMN IF NOT EXISTS "metaLeadId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "AdLead_metaLeadId_key" ON "AdLead"("metaLeadId") WHERE "metaLeadId" IS NOT NULL;
