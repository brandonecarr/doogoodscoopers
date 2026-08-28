-- Costs, so revenue can be judged against something. Two kinds:
--   recurring: fixed monthly overhead (insurance, software, phone). Counted in
--              every month between startedOn and endedOn (null = still running).
--   onetime:   a single dated cost (a repair, a batch of supplies, an ad spend).
-- Money is INTEGER CENTS, matching SngInvoice, so a P&L never drifts.
CREATE TABLE IF NOT EXISTS "Expense" (
  "id"          TEXT PRIMARY KEY,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT now(),
  "kind"        TEXT NOT NULL DEFAULT 'recurring',
  "category"    TEXT NOT NULL DEFAULT 'other',
  "label"       TEXT NOT NULL,
  "vendor"      TEXT,
  "amountCents" INTEGER NOT NULL DEFAULT 0,
  "occurredOn"  TIMESTAMP(3),
  "startedOn"   TIMESTAMP(3),
  "endedOn"     TIMESTAMP(3),
  "notes"       TEXT
);
CREATE INDEX IF NOT EXISTS "Expense_kind_idx" ON "Expense" ("kind");
CREATE INDEX IF NOT EXISTS "Expense_category_idx" ON "Expense" ("category");
CREATE INDEX IF NOT EXISTS "Expense_occurredOn_idx" ON "Expense" ("occurredOn");
CREATE INDEX IF NOT EXISTS "Expense_startedOn_idx" ON "Expense" ("startedOn");
