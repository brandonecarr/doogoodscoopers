-- Keyword Radar: a weekly AI (+ optional Google Ads) report of new / trending /
-- hot keywords to feed into Google Ads. Modeled on the Marketing Director's
-- weekly-plan pattern (one report per week, child items you can act on).

CREATE TABLE IF NOT EXISTS "KeywordReport" (
  "id"            TEXT PRIMARY KEY,
  "weekOf"        TIMESTAMP(3) NOT NULL,
  "generatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "model"         TEXT,
  "summary"       TEXT NOT NULL,
  "usedGoogleAds" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "KeywordReport_weekOf_key" ON "KeywordReport"("weekOf");

CREATE TABLE IF NOT EXISTS "KeywordItem" (
  "id"              TEXT PRIMARY KEY,
  "reportId"        TEXT NOT NULL REFERENCES "KeywordReport"("id") ON DELETE CASCADE,
  "weekOf"          TIMESTAMP(3) NOT NULL,
  "term"            TEXT NOT NULL,
  "bucket"          TEXT NOT NULL,                       -- NEW | TRENDING | HOT
  "intent"          TEXT,                                -- commercial | local | informational | branded
  "matchType"       TEXT,                                -- exact | phrase | broad
  "rationale"       TEXT,
  "adGroup"         TEXT,
  "competitor"      TEXT,
  "monthlySearches" INTEGER,
  "competition"     TEXT,                                -- LOW | MEDIUM | HIGH
  "topBidLow"       DOUBLE PRECISION,
  "topBidHigh"      DOUBLE PRECISION,
  "source"          TEXT NOT NULL DEFAULT 'ai',          -- ai | google_ads
  "isNegative"      BOOLEAN NOT NULL DEFAULT false,
  "status"          TEXT NOT NULL DEFAULT 'NEW',         -- NEW | IMPLEMENTED | DISMISSED
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "KeywordItem_reportId_idx" ON "KeywordItem"("reportId");
CREATE INDEX IF NOT EXISTS "KeywordItem_weekOf_idx" ON "KeywordItem"("weekOf");
CREATE INDEX IF NOT EXISTS "KeywordItem_status_idx" ON "KeywordItem"("status");

CREATE TABLE IF NOT EXISTS "KeywordCompetitor" (
  "id"        TEXT PRIMARY KEY,
  "name"      TEXT NOT NULL,
  "website"   TEXT,
  "active"    BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the starting competitor set (editable in the UI).
INSERT INTO "KeywordCompetitor" ("id","name","website","sortOrder") VALUES
  ('kwc_swoopscoop',   'Swoop Scoop',    NULL, 0),
  ('kwc_doodycalls',   'DoodyCalls',     'doodycalls.com', 1),
  ('kwc_scoopsoldiers','Scoop Soldiers', 'scoopsoldiers.com', 2),
  ('kwc_petbutler',    'Pet Butler',     'petbutler.com', 3)
ON CONFLICT ("id") DO NOTHING;
