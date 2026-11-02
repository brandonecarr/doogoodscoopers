-- Sweep&Go payments mirror: one row per payment attempt in the /payments feed.
-- Profitability revenue is CASH BASIS — payments by the date the money moved —
-- which is also how Sweep&Go's own reports count a month. (Invoices are dated by
-- creation, so an October invoice paid by check on Nov 1 was landing in October.)
CREATE TABLE IF NOT EXISTS "SngPayment" (
  "id"                 TEXT PRIMARY KEY,
  "key"                TEXT NOT NULL UNIQUE,
  "paidOn"             DATE NOT NULL,
  "amountCents"        INTEGER NOT NULL DEFAULT 0,
  "refundedCents"      INTEGER NOT NULL DEFAULT 0,
  "tipCents"           INTEGER NOT NULL DEFAULT 0,
  "status"             TEXT,
  "method"             TEXT,
  "description"        TEXT,
  "invoiceNumber"      TEXT,
  "clientName"         TEXT,
  "nameKey"            TEXT NOT NULL,
  "commercialClient"   TEXT,
  "commercialLocation" TEXT,
  "syncedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "SngPayment_paidOn_idx" ON "SngPayment" ("paidOn");
CREATE INDEX IF NOT EXISTS "SngPayment_nameKey_idx" ON "SngPayment" ("nameKey");
CREATE INDEX IF NOT EXISTS "SngPayment_invoiceNumber_idx" ON "SngPayment" ("invoiceNumber");
CREATE INDEX IF NOT EXISTS "SngPayment_status_idx" ON "SngPayment" ("status");
