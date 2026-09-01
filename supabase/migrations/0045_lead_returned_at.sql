-- A prospect who submitted a form again. Set by recordReengagement.
-- Drip auto-enrollment (findDripCandidates) skips any lead with this set, so a
-- returning lead can never be swept into a cold-lead drip as if they were new.
ALTER TABLE "QuoteLead" ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);
ALTER TABLE "AdLead"    ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "QuoteLead_returnedAt_idx" ON "QuoteLead"("returnedAt");
CREATE INDEX IF NOT EXISTS "AdLead_returnedAt_idx"    ON "AdLead"("returnedAt");

-- Backfill from the re-engagement notes already written by recordReengagement.
UPDATE "QuoteLead" q SET "returnedAt" = s.at
FROM (SELECT "leadId", MAX("createdAt") AS at FROM "LeadUpdate"
      WHERE "leadType" = 'QUOTE_FORM' AND "message" LIKE '%Returning lead%'
      GROUP BY "leadId") s
WHERE q.id = s."leadId" AND q."returnedAt" IS NULL;

UPDATE "AdLead" a SET "returnedAt" = s.at
FROM (SELECT "leadId", MAX("createdAt") AS at FROM "LeadUpdate"
      WHERE "leadType" = 'AD_LEAD' AND "message" LIKE '%Returning lead%'
      GROUP BY "leadId") s
WHERE a.id = s."leadId" AND a."returnedAt" IS NULL;
