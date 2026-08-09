-- Route-planning scratchpad: the weekday the owner has *planned* to service a
-- customer. Local-only; never synced to Sweep&Go. One row per customer.
-- Additive + idempotent, matching the project's migration convention.

CREATE TABLE IF NOT EXISTS "RoutePlanAssignment" (
  "id" TEXT PRIMARY KEY,
  "customerId" TEXT NOT NULL UNIQUE,
  "dayOfWeek" INTEGER NOT NULL,
  "updatedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "RoutePlanAssignment_dayOfWeek_idx"
  ON "RoutePlanAssignment" ("dayOfWeek");

ALTER TABLE "RoutePlanAssignment" ENABLE ROW LEVEL SECURITY;
