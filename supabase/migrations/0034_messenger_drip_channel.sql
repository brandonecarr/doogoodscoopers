-- Messenger-first drip: link an AdLead to its Facebook Messenger thread (PSID)
-- and track the reply window; a per-campaign send channel (sms | messenger).
ALTER TABLE "AdLead" ADD COLUMN IF NOT EXISTS "messengerPsid" TEXT;
ALTER TABLE "AdLead" ADD COLUMN IF NOT EXISTS "messengerLastInboundAt" TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS "AdLead_messengerPsid_key" ON "AdLead"("messengerPsid");
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL DEFAULT 'sms';
