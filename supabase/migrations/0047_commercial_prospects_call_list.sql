-- Researched commercial prospects (HOAs, apartment complexes, 55+ communities)
-- that sit on a call list until contacted, then become a CommercialLead or are archived.
CREATE TABLE IF NOT EXISTS "CommercialProspect" (
  "id"              TEXT PRIMARY KEY,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'TO_CALL',
  "propertyType"    TEXT NOT NULL DEFAULT 'OTHER',
  "propertyName"    TEXT NOT NULL,
  "contactName"     TEXT,
  "phone"           TEXT,
  "email"           TEXT,
  "city"            TEXT NOT NULL,
  "state"           TEXT NOT NULL DEFAULT 'CA',
  "zipCode"         TEXT NOT NULL,
  "units"           INTEGER,
  "notes"           TEXT,
  "source"          TEXT,
  "attempts"        INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt"   TIMESTAMP(3),
  "convertedLeadId" TEXT,
  "archivedAt"      TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "CommercialProspect_status_idx"       ON "CommercialProspect"("status");
CREATE INDEX IF NOT EXISTS "CommercialProspect_propertyType_idx" ON "CommercialProspect"("propertyType");
CREATE INDEX IF NOT EXISTS "CommercialProspect_city_idx"         ON "CommercialProspect"("city");
CREATE INDEX IF NOT EXISTS "CommercialProspect_zipCode_idx"      ON "CommercialProspect"("zipCode");
CREATE INDEX IF NOT EXISTS "CommercialProspect_createdAt_idx"    ON "CommercialProspect"("createdAt");
