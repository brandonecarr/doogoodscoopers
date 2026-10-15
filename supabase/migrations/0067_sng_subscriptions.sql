-- Mirror of Sweep&Go's residential subscriptions feed (v2 /subscriptions), replaced in
-- full on every successful pull. Used for the Office TV's "next month" invoice projection
-- (sum of every active subscription's monthly amount). The feed has no subscription id,
-- so rows are a snapshot, not an upsert target.
CREATE TABLE IF NOT EXISTS "SngSubscription" (
  "id"               TEXT PRIMARY KEY,
  "syncedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clientName"       TEXT,
  "clientEmail"      TEXT,
  "nameKey"          TEXT NOT NULL,
  "status"           TEXT NOT NULL,
  "category"         TEXT,
  "billingInterval"  TEXT,
  "name"             TEXT,
  "priceCents"       INTEGER NOT NULL DEFAULT 0,
  "pricingPlan"      TEXT,
  "servicePlan"      TEXT,
  "frequency"        TEXT,
  "numberOfDogs"     TEXT,
  "zipCode"          TEXT,
  "startDate"        TIMESTAMP(3),
  "endDate"          TIMESTAMP(3),
  "canceledAt"       TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "pauseStart"       TIMESTAMP(3),
  "pauseEnd"         TIMESTAMP(3),
  "couponCode"       TEXT,
  "couponPercent"    DOUBLE PRECISION,
  "couponEnd"        TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "SngSubscription_status_idx" ON "SngSubscription"("status");
CREATE INDEX IF NOT EXISTS "SngSubscription_nameKey_idx" ON "SngSubscription"("nameKey");
