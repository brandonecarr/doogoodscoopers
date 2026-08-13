-- Customer-lifecycle events powering the Customers → Dashboard growth chart.
-- Seeded retroactively from historical CSVs; kept current by the sync-customers cron.
CREATE TABLE IF NOT EXISTS "SubscriptionEvent" (
  id text PRIMARY KEY,
  kind text NOT NULL,               -- SIGNUP | CANCELLATION | QUOTE
  "occurredAt" timestamp(3) NOT NULL,
  "clientName" text,
  email text,
  city text,
  "zipCode" text,
  plan text,
  revenue double precision,
  reason text,
  source text NOT NULL,
  "dedupeKey" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionEvent_dedupeKey_key" ON "SubscriptionEvent"("dedupeKey");
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_kind_idx" ON "SubscriptionEvent"(kind);
CREATE INDEX IF NOT EXISTS "SubscriptionEvent_occurredAt_idx" ON "SubscriptionEvent"("occurredAt");
