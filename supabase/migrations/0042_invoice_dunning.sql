-- Failed-payment recovery. Sweep&Go sets `next_try_charging` on an invoice when
-- a card is declined and a retry is scheduled — that plus an unpaid balance is
-- our "the payment failed" signal, straight from the invoice feed.
-- The dunning columns are local bookkeeping and are never overwritten by a sync.
ALTER TABLE "SngInvoice" ADD COLUMN IF NOT EXISTS "nextTryChargingAt" TIMESTAMP(3);
ALTER TABLE "SngInvoice" ADD COLUMN IF NOT EXISTS "dunningStage" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SngInvoice" ADD COLUMN IF NOT EXISTS "dunningLastAt" TIMESTAMP(3);
ALTER TABLE "SngInvoice" ADD COLUMN IF NOT EXISTS "dunningResolvedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "SngInvoice_remainingCents_idx" ON "SngInvoice" ("remainingCents");
