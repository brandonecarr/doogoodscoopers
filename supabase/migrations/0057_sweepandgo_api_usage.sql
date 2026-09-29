-- Sweep&Go API usage counter: one row per Pacific day per endpoint, incremented
-- on every outbound Sweep&Go request. Added after Sweep&Go support flagged ~70k
-- requests/month (a free-quotes poll running every minute). A day crossing the
-- alert threshold sends one admin push; the "__alert__" row marks it as sent.
CREATE TABLE IF NOT EXISTS "SngApiUsage" (
  "day"      DATE    NOT NULL,
  "endpoint" TEXT    NOT NULL,   -- e.g. "GET /api/v2/free_quotes"
  "count"    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY ("day", "endpoint")
);
