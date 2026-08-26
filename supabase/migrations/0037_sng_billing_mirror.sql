-- Local mirror of Sweep&Go billing (invoices + payments), synced by cron.
-- Amounts are stored in CENTS as integers: summing hundreds of rows must not
-- drift, and Sweep&Go returns money as strings ("73.75").
-- Sweep&Go's invoice/payment feeds carry NO client id — only client_name — so
-- "nameKey" is the normalized join key back to SweepandgoCustomer.

CREATE TABLE IF NOT EXISTS "SngInvoice" (
  "id"              TEXT PRIMARY KEY,
  "invoiceNumber"   TEXT NOT NULL,
  "clientName"      TEXT,
  "nameKey"         TEXT NOT NULL,
  "status"          TEXT,
  "type"            TEXT,
  "category"        TEXT,
  "billingInterval" TEXT,
  "payMethod"       TEXT,
  "totalCents"      INTEGER NOT NULL DEFAULT 0,
  "paidCents"       INTEGER NOT NULL DEFAULT 0,
  "refundedCents"   INTEGER NOT NULL DEFAULT 0,
  "remainingCents"  INTEGER NOT NULL DEFAULT 0,
  "tipCents"        INTEGER NOT NULL DEFAULT 0,
  "periodStart"     TIMESTAMP(3),
  "periodEnd"       TIMESTAMP(3),
  "sngCreatedAt"    TIMESTAMP(3),
  "syncedAt"        TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "SngInvoice_invoiceNumber_key" ON "SngInvoice" ("invoiceNumber");
CREATE INDEX IF NOT EXISTS "SngInvoice_nameKey_idx" ON "SngInvoice" ("nameKey");
CREATE INDEX IF NOT EXISTS "SngInvoice_status_idx" ON "SngInvoice" ("status");
CREATE INDEX IF NOT EXISTS "SngInvoice_sngCreatedAt_idx" ON "SngInvoice" ("sngCreatedAt");

CREATE TABLE IF NOT EXISTS "SngPayment" (
  "id"            TEXT PRIMARY KEY,
  "clientName"    TEXT,
  "nameKey"       TEXT NOT NULL,
  "paidOn"        TIMESTAMP(3),
  "amountCents"   INTEGER NOT NULL DEFAULT 0,
  "refundedCents" INTEGER NOT NULL DEFAULT 0,
  "tipCents"      INTEGER NOT NULL DEFAULT 0,
  "status"        TEXT,
  "method"        TEXT,
  "description"   TEXT,
  "syncedAt"      TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "SngPayment_nameKey_idx" ON "SngPayment" ("nameKey");
CREATE INDEX IF NOT EXISTS "SngPayment_status_idx" ON "SngPayment" ("status");
CREATE INDEX IF NOT EXISTS "SngPayment_paidOn_idx" ON "SngPayment" ("paidOn");
