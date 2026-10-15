-- Sections saved from the email designer for reuse (Content → Saved).
CREATE TABLE IF NOT EXISTS "EmailSavedSection" (
  "id"        TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name"      TEXT NOT NULL,
  "section"   JSONB NOT NULL,
  "adminEmail" TEXT
);
CREATE INDEX IF NOT EXISTS "EmailSavedSection_createdAt_idx" ON "EmailSavedSection"("createdAt");
