-- OfficeTV: the Apple TV "Growth Board" reads the admin through /api/tv/*.
--   Task           the team task board (/admin/tasks), shown on the TV's Operations board.
--   TvConfig       the TV's boards, hero goal and pipeline stages, edited on the TV or iPhone.
--   TvMetricDaily  one value per metric per day (active customers), for pace and milestones.
--   TvConnectorKey hashed keys a TV uses to call /api/tv/*. The raw key is shown once.
CREATE TABLE IF NOT EXISTS "Task" (
  "id"        TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "title"     TEXT NOT NULL,
  "notes"     TEXT,
  "tag"       TEXT,
  "status"    TEXT NOT NULL DEFAULT 'TODO',   -- TODO | DOING | DONE
  "owner"     TEXT,
  "dueOn"     TIMESTAMP(3),
  "doneAt"    TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS "Task_status_sortOrder_idx" ON "Task" ("status", "sortOrder");
CREATE INDEX IF NOT EXISTS "Task_doneAt_idx" ON "Task" ("doneAt");

CREATE TABLE IF NOT EXISTS "TvConfig" (
  "id"        TEXT PRIMARY KEY,                -- 'default'
  "config"    JSONB NOT NULL,
  "version"   INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "TvMetricDaily" (
  "date"      TEXT NOT NULL,                   -- YYYY-MM-DD in America/Los_Angeles
  "metric"    TEXT NOT NULL,                   -- e.g. 'active_customers'
  "value"     DOUBLE PRECISION NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("date", "metric")
);

CREATE TABLE IF NOT EXISTS "TvConnectorKey" (
  "id"         TEXT PRIMARY KEY,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "label"      TEXT NOT NULL,
  "keyHash"    TEXT NOT NULL UNIQUE,           -- sha256 hex of the raw key
  "keyPreview" TEXT NOT NULL,                  -- last 4 characters, for recognising a key
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt"  TIMESTAMP(3)
);

-- Server-only tables (Prisma connects as the owner); keep them closed to the anon/auth API roles.
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TvConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TvMetricDaily" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TvConnectorKey" ENABLE ROW LEVEL SECURITY;
