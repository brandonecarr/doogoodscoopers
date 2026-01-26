-- Migration: Expand frequency check constraints to support all cleanup frequencies
-- This adds support for daily, multi-weekly, and other frequency options

-- Update pricing_rules frequency constraint
alter table public.pricing_rules drop constraint if exists pricing_rules_frequency_check;
alter table public.pricing_rules add constraint pricing_rules_frequency_check
  check (frequency in (
    'SEVEN_TIMES_A_WEEK',
    'SIX_TIMES_A_WEEK',
    'FIVE_TIMES_A_WEEK',
    'FOUR_TIMES_A_WEEK',
    'THREE_TIMES_A_WEEK',
    'TWICE_WEEKLY',
    'WEEKLY',
    'BIWEEKLY',
    'TWICE_PER_MONTH',
    'EVERY_THREE_WEEKS',
    'EVERY_FOUR_WEEKS',
    'MONTHLY',
    'ONETIME'
  ));

-- Update subscriptions frequency constraint
alter table public.subscriptions drop constraint if exists subscriptions_frequency_check;
alter table public.subscriptions add constraint subscriptions_frequency_check
  check (frequency in (
    'SEVEN_TIMES_A_WEEK',
    'SIX_TIMES_A_WEEK',
    'FIVE_TIMES_A_WEEK',
    'FOUR_TIMES_A_WEEK',
    'THREE_TIMES_A_WEEK',
    'TWICE_WEEKLY',
    'WEEKLY',
    'BIWEEKLY',
    'TWICE_PER_MONTH',
    'EVERY_THREE_WEEKS',
    'EVERY_FOUR_WEEKS',
    'MONTHLY',
    'ONETIME'
  ));

-- Update service_plans frequency constraint
alter table public.service_plans drop constraint if exists service_plans_frequency_check;
alter table public.service_plans add constraint service_plans_frequency_check
  check (frequency in (
    'SEVEN_TIMES_A_WEEK',
    'SIX_TIMES_A_WEEK',
    'FIVE_TIMES_A_WEEK',
    'FOUR_TIMES_A_WEEK',
    'THREE_TIMES_A_WEEK',
    'TWICE_WEEKLY',
    'WEEKLY',
    'BIWEEKLY',
    'TWICE_PER_MONTH',
    'EVERY_THREE_WEEKS',
    'EVERY_FOUR_WEEKS',
    'MONTHLY',
    'ONETIME'
  ));

-- Update jobs frequency constraint if it exists
alter table public.jobs drop constraint if exists jobs_frequency_check;
alter table public.jobs add constraint jobs_frequency_check
  check (frequency in (
    'SEVEN_TIMES_A_WEEK',
    'SIX_TIMES_A_WEEK',
    'FIVE_TIMES_A_WEEK',
    'FOUR_TIMES_A_WEEK',
    'THREE_TIMES_A_WEEK',
    'TWICE_WEEKLY',
    'WEEKLY',
    'BIWEEKLY',
    'TWICE_PER_MONTH',
    'EVERY_THREE_WEEKS',
    'EVERY_FOUR_WEEKS',
    'MONTHLY',
    'ONETIME'
  ));
