-- Campaign drips can mix text and email steps; former customers become a drip audience.
ALTER TABLE "CampaignStep" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'sms';
ALTER TABLE "CampaignStep" ADD COLUMN IF NOT EXISTS "subject" TEXT;
ALTER TABLE "CampaignRecipient" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "emailFromName" TEXT;

-- People the owner never wants contacted or re-imported (e.g. problem former customers).
CREATE TABLE IF NOT EXISTS "DoNotContact" (
  "id" TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "sngId" TEXT,
  "reason" TEXT
);
CREATE INDEX IF NOT EXISTS "DoNotContact_sngId_idx" ON "DoNotContact"("sngId");
