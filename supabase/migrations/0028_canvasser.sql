-- Canvasser field tool: door-to-door reps drop map pins (CanvassVisit) and mark
-- homes as leads (CanvasserLead). Both owned per-canvasser (Supabase users.id).
-- Adds a CANVASSER lead source and a CANVASSER portal role.
-- Additive + idempotent, matching the project's migration convention.

-- 1) Every knocked door / dropped pin.
CREATE TABLE IF NOT EXISTS "CanvassVisit" (
  "id"              TEXT PRIMARY KEY,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "canvasserId"     TEXT NOT NULL,
  "canvasserName"   TEXT NOT NULL DEFAULT '',
  "orgId"           TEXT NOT NULL,
  "lat"             DOUBLE PRECISION NOT NULL,
  "lng"             DOUBLE PRECISION NOT NULL,
  "address"         TEXT,
  "city"            TEXT,
  "zipCode"         TEXT,
  "status"          TEXT NOT NULL DEFAULT 'NOT_HOME',
  "notes"           TEXT,
  "canvasserLeadId" TEXT,
  "clientKey"       TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS "CanvassVisit_canvasserId_idx" ON "CanvassVisit" ("canvasserId");
CREATE INDEX IF NOT EXISTS "CanvassVisit_status_idx" ON "CanvassVisit" ("status");
CREATE INDEX IF NOT EXISTS "CanvassVisit_zipCode_idx" ON "CanvassVisit" ("zipCode");
CREATE INDEX IF NOT EXISTS "CanvassVisit_createdAt_idx" ON "CanvassVisit" ("createdAt");

-- 2) The subset of visits marked as a lead — a first-class pipeline lead.
CREATE TABLE IF NOT EXISTS "CanvasserLead" (
  "id"            TEXT PRIMARY KEY,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status"        "LeadStatus" NOT NULL DEFAULT 'NEW',
  "archived"      BOOLEAN NOT NULL DEFAULT false,
  "notes"         TEXT,
  "followupDate"  TIMESTAMP(3),
  "grade"         TEXT,
  "firstName"     TEXT,
  "lastName"      TEXT,
  "email"         TEXT,
  "phone"         TEXT,
  "address"       TEXT,
  "city"          TEXT,
  "zipCode"       TEXT,
  "canvasserId"   TEXT NOT NULL,
  "canvasserName" TEXT NOT NULL DEFAULT '',
  "orgId"         TEXT NOT NULL,
  "visitId"       TEXT,
  "clientKey"     TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS "CanvasserLead_status_idx" ON "CanvasserLead" ("status");
CREATE INDEX IF NOT EXISTS "CanvasserLead_archived_idx" ON "CanvasserLead" ("archived");
CREATE INDEX IF NOT EXISTS "CanvasserLead_createdAt_idx" ON "CanvasserLead" ("createdAt");
CREATE INDEX IF NOT EXISTS "CanvasserLead_zipCode_idx" ON "CanvasserLead" ("zipCode");
CREATE INDEX IF NOT EXISTS "CanvasserLead_followupDate_idx" ON "CanvasserLead" ("followupDate");
CREATE INDEX IF NOT EXISTS "CanvasserLead_canvasserId_idx" ON "CanvasserLead" ("canvasserId");

-- 3) New lead source value (polymorphic sub-tables key on it).
ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'CANVASSER';

-- 4) Allow the CANVASSER portal role on the Supabase users table (widen the
--    role CHECK from 0001_initial_schema.sql).
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('OWNER','MANAGER','OFFICE','CREW_LEAD','FIELD_TECH','ACCOUNTANT','CANVASSER','CLIENT'));

ALTER TABLE "CanvassVisit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CanvasserLead" ENABLE ROW LEVEL SECURITY;
