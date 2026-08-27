-- Remove the Sweep&Go payments mirror. Lifetime revenue is computed from the
-- INVOICE feed (every invoice carries paid/refunded), so this table was never
-- read after that switch. Its companion migrations 0038 and 0039 are deleted
-- from the repo; 0037 stays because it also creates SngInvoice, which is live.
DROP TABLE IF EXISTS "SngPayment";
