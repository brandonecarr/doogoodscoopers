-- One-time Messenger auto-greeting guard: set when we auto-reply so we never
-- greet the same conversation twice (atomic via a conditional update).
ALTER TABLE "AdLead" ADD COLUMN IF NOT EXISTS "messengerGreetedAt" TIMESTAMP(3);
