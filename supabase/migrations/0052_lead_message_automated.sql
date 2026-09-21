-- Distinguish machine-generated inbound messages (e.g. the Meta lead-ad form
-- summary that Facebook auto-sends from the lead's account on submission) from a
-- genuine human reply. Stop-on-reply drips must ignore the automated ones — the
-- lead hasn't actually replied, so the drip must not be stopped.
ALTER TABLE "LeadMessage" ADD COLUMN IF NOT EXISTS "automated" BOOLEAN NOT NULL DEFAULT false;
