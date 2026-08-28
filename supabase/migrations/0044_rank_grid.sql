-- Local rank grid (Local Falcon style): query Google Places from dozens of
-- lat/lng points around a city and record where the business ranks at each one.
-- Ranking in local search is distance-sensitive, so a single "where do we rank"
-- number is meaningless — the grid is the answer.

CREATE TABLE IF NOT EXISTS "RankGridCity" (
  "id"        TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "name"      TEXT NOT NULL,
  "lat"       DOUBLE PRECISION NOT NULL,
  "lng"       DOUBLE PRECISION NOT NULL,
  "gridSize"  INTEGER NOT NULL DEFAULT 7,
  "spacingKm" DOUBLE PRECISION NOT NULL DEFAULT 2,
  "active"    BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS "RankGridCity_active_idx" ON "RankGridCity" ("active");

CREATE TABLE IF NOT EXISTS "RankGridScan" (
  "id"           TEXT PRIMARY KEY,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT now(),
  "cityId"       TEXT NOT NULL,
  "cityName"     TEXT NOT NULL,
  "keyword"      TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "gridSize"     INTEGER NOT NULL,
  "spacingKm"    DOUBLE PRECISION NOT NULL,
  "pointCount"   INTEGER NOT NULL DEFAULT 0,
  "foundCount"   INTEGER NOT NULL DEFAULT 0,
  "top3Count"    INTEGER NOT NULL DEFAULT 0,
  "avgRank"      DOUBLE PRECISION,
  "status"       TEXT NOT NULL DEFAULT 'ok',
  "error"        TEXT
);
CREATE INDEX IF NOT EXISTS "RankGridScan_cityId_idx" ON "RankGridScan" ("cityId");
CREATE INDEX IF NOT EXISTS "RankGridScan_createdAt_idx" ON "RankGridScan" ("createdAt");

CREATE TABLE IF NOT EXISTS "RankGridPoint" (
  "id"       TEXT PRIMARY KEY,
  "scanId"   TEXT NOT NULL,
  "lat"      DOUBLE PRECISION NOT NULL,
  "lng"      DOUBLE PRECISION NOT NULL,
  "rank"     INTEGER,
  "topNames" TEXT
);
CREATE INDEX IF NOT EXISTS "RankGridPoint_scanId_idx" ON "RankGridPoint" ("scanId");
