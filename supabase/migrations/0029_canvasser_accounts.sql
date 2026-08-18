-- Isolated canvasser login accounts (managed from /admin, separate from the
-- Supabase office/field/client staff). Password set via emailed invite.
-- Additive + idempotent.

CREATE TABLE IF NOT EXISTS "Canvasser" (
  "id"              TEXT PRIMARY KEY,
  "email"           TEXT NOT NULL UNIQUE,
  "name"            TEXT NOT NULL,
  "passwordHash"    TEXT,
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "inviteTokenHash" TEXT UNIQUE,
  "inviteExpires"   TIMESTAMP(3),
  "invitedAt"       TIMESTAMP(3),
  "lastLoginAt"     TIMESTAMP(3),
  "createdBy"       TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Canvasser_active_idx" ON "Canvasser" ("active");

ALTER TABLE "Canvasser" ENABLE ROW LEVEL SECURITY;
