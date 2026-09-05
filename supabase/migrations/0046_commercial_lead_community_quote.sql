-- Community-quote inputs captured on a commercial lead after it exists.
-- Stored as the calculator's own field record so the lead page can reopen it
-- exactly as it was left; the PDF agreement is generated from the same data.
ALTER TABLE "CommercialLead" ADD COLUMN IF NOT EXISTS "communityQuote" JSONB;
ALTER TABLE "CommercialLead" ADD COLUMN IF NOT EXISTS "communityQuotedAt" TIMESTAMP(3);
