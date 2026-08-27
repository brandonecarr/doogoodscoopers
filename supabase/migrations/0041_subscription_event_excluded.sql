-- Test signups made while trialling the Sweep&Go onboarding flow inflate the
-- growth dashboard's signup/cancellation counts. Sweep&Go has no way to delete
-- them, so they are flagged here instead of destroyed — reversible, and the
-- audit trail survives.
ALTER TABLE "SubscriptionEvent" ADD COLUMN IF NOT EXISTS "excluded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SubscriptionEvent" ADD COLUMN IF NOT EXISTS "excludedReason" TEXT;
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_excluded_idx" ON "SubscriptionEvent" ("excluded");

-- The 9 verified test identities (all $0 paid, 0 invoices, none active).
UPDATE "SubscriptionEvent"
SET "excluded" = true,
    "excludedReason" = 'test signup — verified $0 paid, 0 invoices, not an active customer'
WHERE "clientName" IN (
  'Brandon Test','Brandon Quote Request','Brandon ewr','brandon sdfsdf',
  'eewrewr fsdfsdf','hsuildfhgiul ewrewr','Brandon asdasf','Brandon erewrewr','Test test'
);
