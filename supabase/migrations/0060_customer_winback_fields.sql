-- Former-customer details from the owner's cancelled-client export (for win-back
-- campaigns). Not provided by Sweep&Go's active-clients feed, so the customer sync
-- never overwrites them.
ALTER TABLE "SweepandgoCustomer" ADD COLUMN IF NOT EXISTS "city"           TEXT;
ALTER TABLE "SweepandgoCustomer" ADD COLUMN IF NOT EXISTS "smsConsent"     BOOLEAN;  -- true = "SMS Messaging Consent: Yes"; null = none on record
ALTER TABLE "SweepandgoCustomer" ADD COLUMN IF NOT EXISTS "referralSource" TEXT;
ALTER TABLE "SweepandgoCustomer" ADD COLUMN IF NOT EXISTS "referralDetail" TEXT;
