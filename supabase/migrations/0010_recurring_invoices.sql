-- Migration: 0010_recurring_invoices
-- Description: Add fields to support recurring invoices linked to subscriptions

-- Add subscription_id to invoices table to link recurring invoices to subscriptions
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL;

-- Add tip_cents to track tips on invoices
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS tip_cents int NOT NULL DEFAULT 0;

-- Add billing_option to track how the subscription is billed
-- (Can be derived from subscription but stored for historical accuracy)
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS billing_option text CHECK (billing_option IN ('PREPAID_FIXED', 'PREPAID_VARIABLE', 'POSTPAID'));

-- Add billing_interval for the invoice period
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS billing_interval text CHECK (billing_interval IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'));

-- Add payment_method to track how the invoice was/will be paid
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS payment_method text CHECK (payment_method IN ('CREDIT_CARD', 'CHECK', 'CASH', 'ACH', 'OTHER'));

-- Create index for filtering recurring invoices
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON public.invoices(subscription_id);

-- Create index for filtering by billing option
CREATE INDEX IF NOT EXISTS idx_invoices_billing_option ON public.invoices(org_id, billing_option);

-- Add billing_option and billing_interval to subscriptions table if not present
ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS billing_option text NOT NULL DEFAULT 'PREPAID_FIXED'
  CHECK (billing_option IN ('PREPAID_FIXED', 'PREPAID_VARIABLE', 'POSTPAID'));

ALTER TABLE public.subscriptions
ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'MONTHLY'
  CHECK (billing_interval IN ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY'));

-- Add default payment_method to clients
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS default_payment_method text
  CHECK (default_payment_method IN ('CREDIT_CARD', 'CHECK', 'CASH', 'ACH', 'OTHER'));
