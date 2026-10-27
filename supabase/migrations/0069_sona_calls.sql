-- Sona (Quo's AI agent) outbound calls placed from a lead's profile.
CREATE TABLE IF NOT EXISTS "SonaCall" (
  "id"                 TEXT PRIMARY KEY,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leadType"           "LeadSource" NOT NULL,
  "leadId"             TEXT NOT NULL,
  "leadName"           TEXT,
  "fromNumber"         TEXT NOT NULL,
  "toNumber"           TEXT NOT NULL,
  "task"               TEXT NOT NULL,
  "voicemail"          TEXT NOT NULL DEFAULT 'hang-up',
  "voicemailMessage"   TEXT,
  "maxDurationSeconds" INTEGER NOT NULL DEFAULT 300,
  "idempotencyKey"     TEXT NOT NULL UNIQUE,
  "agentCallId"        TEXT UNIQUE,
  "status"             TEXT NOT NULL DEFAULT 'queued',
  "title"              TEXT,
  "summary"            TEXT,
  "collectedData"      JSONB,
  "rawResult"          JSONB,
  "error"              TEXT,
  "startedBy"          TEXT NOT NULL,
  "startedAt"          TIMESTAMP(3),
  "endedAt"            TIMESTAMP(3),
  "lastPolledAt"       TIMESTAMP(3),
  "noteId"             TEXT
);
CREATE INDEX IF NOT EXISTS "SonaCall_lead_idx" ON "SonaCall"("leadType", "leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "SonaCall_status_idx" ON "SonaCall"("status");
