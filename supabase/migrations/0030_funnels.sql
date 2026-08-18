-- No-code lead funnels (Heyflow-style): a funnel stored as JSON, plus per-visitor
-- sessions and per-step events for analytics. Additive + idempotent.

CREATE TABLE IF NOT EXISTS "Funnel" (
  "id"        TEXT PRIMARY KEY,
  "slug"      TEXT NOT NULL UNIQUE,
  "name"      TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'draft',
  "data"      JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Funnel_status_idx" ON "Funnel" ("status");

CREATE TABLE IF NOT EXISTS "FunnelSession" (
  "id"          TEXT PRIMARY KEY,
  "funnelId"    TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "variant"     TEXT NOT NULL DEFAULT 'A',
  "attribution" JSONB,
  "leadId"      TEXT,
  "leadType"    TEXT,
  "startedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "FunnelSession_funnelId_idx" ON "FunnelSession" ("funnelId");
CREATE INDEX IF NOT EXISTS "FunnelSession_startedAt_idx" ON "FunnelSession" ("startedAt");

CREATE TABLE IF NOT EXISTS "FunnelEvent" (
  "id"        TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "funnelId"  TEXT NOT NULL,
  "variant"   TEXT NOT NULL DEFAULT 'A',
  "step"      TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "payload"   JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "FunnelEvent_funnelId_createdAt_idx" ON "FunnelEvent" ("funnelId", "createdAt");
CREATE INDEX IF NOT EXISTS "FunnelEvent_sessionId_idx" ON "FunnelEvent" ("sessionId");

ALTER TABLE "Funnel" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FunnelSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FunnelEvent" ENABLE ROW LEVEL SECURITY;
