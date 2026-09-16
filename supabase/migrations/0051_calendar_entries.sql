-- Manual calendar entries for the Leads calendar. Lead follow-ups are derived
-- live from each lead table's followupDate; these rows are the manually-added
-- events (reminders, appointments) that don't belong to a specific lead.
CREATE TABLE IF NOT EXISTS "CalendarEntry" (
  "id"        TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "title"     TEXT NOT NULL,
  "startAt"   TIMESTAMP(3) NOT NULL,
  "endAt"     TIMESTAMP(3),
  "allDay"    BOOLEAN NOT NULL DEFAULT false,
  "notes"     TEXT,
  "location"  TEXT,
  "color"     TEXT
);

CREATE INDEX IF NOT EXISTS "CalendarEntry_startAt_idx" ON "CalendarEntry" ("startAt");
