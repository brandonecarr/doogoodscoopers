-- Every Sweep&Go webhook delivery, recorded as received (step 1 of moving from
-- polling to webhooks). Shows which events Sweep&Go actually sends us, their
-- real payloads, delivery latency (receivedAt vs Sweep&Go's createdAt) and
-- duplicate deliveries (same dedupKey) before any feature depends on them.
-- No behavior depends on this table. Rows older than 90 days are pruned.
CREATE TABLE IF NOT EXISTS "SngWebhookEvent" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "receivedAt"    TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "type"          TEXT NOT NULL,          -- e.g. "job:completed" ("" if missing)
  "sngEventId"    TEXT,                   -- Sweep&Go's event id, when sent
  "sngCreatedAt"  TIMESTAMPTZ(3),         -- Sweep&Go's own timestamp, when sent
  "clientId"      TEXT,                   -- data.client, e.g. "rcl_..."
  "dedupKey"      TEXT NOT NULL,          -- sha256(type + data): repeats share it
  "secretMatched" BOOLEAN,                -- null when no secret is configured
  "authSeen"      JSONB,                  -- WHERE a token appeared, never its value
  "payload"       JSONB NOT NULL
);
CREATE INDEX IF NOT EXISTS "SngWebhookEvent_receivedAt_idx" ON "SngWebhookEvent"("receivedAt");
CREATE INDEX IF NOT EXISTS "SngWebhookEvent_type_idx" ON "SngWebhookEvent"("type");
CREATE INDEX IF NOT EXISTS "SngWebhookEvent_dedupKey_idx" ON "SngWebhookEvent"("dedupKey");
