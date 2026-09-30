-- Hourly Sweep&Go request totals. Sweep&Go's account limit is 100 requests/hour
-- and 500/day, so the usage guard alerts near the hourly cap as well as daily.
-- "alerted" makes the hourly push fire at most once per hour.
CREATE TABLE IF NOT EXISTS "SngApiUsageHour" (
  "hour"    TIMESTAMPTZ(3) PRIMARY KEY,   -- start of the clock hour
  "count"   INTEGER NOT NULL DEFAULT 0,
  "alerted" BOOLEAN NOT NULL DEFAULT false
);
