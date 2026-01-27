-- Allow subscriptions without a service plan (for dynamic/custom subscriptions)
ALTER TABLE public.subscriptions
  ALTER COLUMN plan_id DROP NOT NULL;

-- Add start_date and end_date columns if they don't exist
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS initial_cleanup_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS initial_cleanup_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Add index on start_date for querying active subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_start_date ON public.subscriptions(start_date);
