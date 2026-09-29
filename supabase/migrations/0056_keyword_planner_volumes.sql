-- Keyword Planner uploads: a persistent library of real Google search volume,
-- competition and top-of-page bids, imported from the CSV that Google Ads
-- Keyword Planner exports. Enriches Keyword Radar reports without needing
-- Google Ads API production access. One row per normalized keyword; a newer
-- upload overwrites the older numbers for the same keyword.

CREATE TABLE IF NOT EXISTS "KeywordVolume" (
  "term"             TEXT PRIMARY KEY,       -- normalized: lowercase, single-spaced
  "displayTerm"      TEXT NOT NULL,
  "monthlySearches"  INTEGER,                -- exact average, or the low end of a range
  "searchesLow"      INTEGER,
  "searchesHigh"     INTEGER,
  "volumeLabel"      TEXT,                   -- as Keyword Planner shows it: "1,300" or "1K–10K"
  "competition"      TEXT,                   -- LOW | MEDIUM | HIGH
  "competitionIndex" INTEGER,                -- 0-100
  "topBidLow"        DOUBLE PRECISION,
  "topBidHigh"       DOUBLE PRECISION,
  "threeMonthChange" TEXT,
  "yoyChange"        TEXT,
  "sourceFile"       TEXT,
  "uploadedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "KeywordVolume_uploadedAt_idx" ON "KeywordVolume"("uploadedAt");

-- Report items keep Keyword Planner's own display (ranges for low-spend accounts).
ALTER TABLE "KeywordItem" ADD COLUMN IF NOT EXISTS "volumeLabel" TEXT;
