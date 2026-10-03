-- Optional sender display name per email automation (e.g. "Brandon at DooGoodScoopers"
-- for the win-back sequence). Sent from the default verified address.
ALTER TABLE "EmailAutomation" ADD COLUMN IF NOT EXISTS "fromName" TEXT;
