-- Marketing Director AI: weekly plan + checkable tasks.
CREATE TABLE IF NOT EXISTS "MarketingPlan" (
  id text PRIMARY KEY, "weekOf" timestamp(3) NOT NULL UNIQUE, theme text NOT NULL,
  summary text NOT NULL, "generatedAt" timestamp(3) NOT NULL DEFAULT now(),
  model text, "createdAt" timestamp(3) NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS "MarketingPlan_weekOf_idx" ON "MarketingPlan"("weekOf");
CREATE TABLE IF NOT EXISTS "MarketingTask" (
  id text PRIMARY KEY, "planId" text NOT NULL REFERENCES "MarketingPlan"(id) ON DELETE CASCADE,
  "weekOf" timestamp(3) NOT NULL, title text NOT NULL, detail text, channel text NOT NULL,
  priority integer NOT NULL DEFAULT 2, "dayHint" text, effort text, rationale text,
  status text NOT NULL DEFAULT 'TODO', "completedAt" timestamp(3),
  "sortOrder" integer NOT NULL DEFAULT 0, "createdAt" timestamp(3) NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS "MarketingTask_weekOf_idx" ON "MarketingTask"("weekOf");
CREATE INDEX IF NOT EXISTS "MarketingTask_status_idx" ON "MarketingTask"(status);
CREATE INDEX IF NOT EXISTS "MarketingTask_planId_idx" ON "MarketingTask"("planId");
