-- Cancellation reasons from Sweep&Go's subscriptions API (termination reason / comment / note).
ALTER TABLE "SubscriptionEvent" ADD COLUMN IF NOT EXISTS "reasonDetail" TEXT;
ALTER TABLE "SweepandgoCustomer" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;
ALTER TABLE "SweepandgoCustomer" ADD COLUMN IF NOT EXISTS "cancelNote" TEXT;
ALTER TABLE "SweepandgoCustomer" ADD COLUMN IF NOT EXISTS "canceledAt" TIMESTAMP(3);
