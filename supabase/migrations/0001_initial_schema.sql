-- DooGoodScoopers Operations Platform Schema
-- Migration: 0001_initial_schema
-- Description: Initial schema for replacing Sweep&Go

-- Enable required extensions
create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- =====================================================
-- CORE TABLES
-- =====================================================

-- 1) Organizations (multi-tenant foundation)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text default '#14b8a6',
  secondary_color text default '#002842',
  phone text,
  email text,
  website text,
  address jsonb not null default '{}'::jsonb,
  timezone text not null default 'America/Los_Angeles',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_organizations_slug on public.organizations(slug);

-- 2) Users (unified auth table, works with Supabase Auth)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role text not null check (role in ('OWNER','MANAGER','OFFICE','CREW_LEAD','FIELD_TECH','ACCOUNTANT','CLIENT')),
  first_name text,
  last_name text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_users_org on public.users(org_id);
create index if not exists idx_users_email on public.users(email);
create index if not exists idx_users_role on public.users(role);

-- 3) Staff Profiles (employee details)
create table if not exists public.staff_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  employee_id text,
  hire_date date,
  hourly_rate_cents int,
  vehicle_type text,
  license_plate text,
  emergency_contact jsonb not null default '{}'::jsonb,
  certifications text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id)
);
create index if not exists idx_staff_profiles_org on public.staff_profiles(org_id);

-- 4) Clients (customer records)
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  stripe_customer_id text unique,
  sweep_and_go_client_id text unique,
  client_type text not null default 'RESIDENTIAL' check (client_type in ('RESIDENTIAL','COMMERCIAL')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','CANCELED','DELINQUENT')),
  first_name text not null,
  last_name text,
  company_name text,
  email text,
  phone text,
  secondary_phone text,
  referral_source text,
  referred_by_client_id uuid references public.clients(id) on delete set null,
  account_credit_cents int not null default 0,
  notes text,
  tags text[] not null default '{}',
  notification_preferences jsonb not null default '{"sms": true, "email": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clients_org on public.clients(org_id);
create index if not exists idx_clients_status on public.clients(org_id, status);
create index if not exists idx_clients_email on public.clients(email);
create index if not exists idx_clients_stripe on public.clients(stripe_customer_id);

-- 5) Client Contacts (additional contacts per client)
create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  first_name text not null,
  last_name text,
  email text,
  phone text,
  relationship text,
  is_primary boolean not null default false,
  can_authorize boolean not null default false,
  notification_preferences jsonb not null default '{"sms": true, "email": true}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_client_contacts_client on public.client_contacts(client_id);

-- 6) Locations (service addresses)
create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  name text,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null default 'CA',
  zip_code text not null,
  country text not null default 'US',
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  gate_code text,
  gate_location text,
  access_notes text,
  service_areas text[] not null default '{}',
  is_primary boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_locations_client on public.locations(client_id);
create index if not exists idx_locations_zip on public.locations(org_id, zip_code);
create index if not exists idx_locations_coords on public.locations(latitude, longitude);

-- 7) Dogs (pet information)
create table if not exists public.dogs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  breed text,
  size text check (size in ('SMALL','MEDIUM','LARGE','XLARGE')),
  color text,
  is_safe boolean not null default true,
  safety_notes text,
  special_instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_dogs_client on public.dogs(client_id);
create index if not exists idx_dogs_location on public.dogs(location_id);

-- =====================================================
-- SERVICE TABLES
-- =====================================================

-- 8) Service Plans
create table if not exists public.service_plans (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  frequency text not null check (frequency in ('WEEKLY','BIWEEKLY','MONTHLY','ONETIME')),
  is_active boolean not null default true,
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_service_plans_org on public.service_plans(org_id);

-- 9) Pricing Rules
create table if not exists public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid references public.service_plans(id) on delete cascade,
  name text not null,
  description text,
  zip_codes text[] not null default '{}',
  zone text check (zone in ('REGULAR','PREMIUM')),
  frequency text check (frequency in ('WEEKLY','BIWEEKLY','MONTHLY','ONETIME')),
  min_dogs int,
  max_dogs int,
  last_cleaned_bracket text,
  base_price_cents int not null,
  per_dog_price_cents int not null default 0,
  initial_cleanup_cents int not null default 0,
  priority int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_pricing_rules_org on public.pricing_rules(org_id);
create index if not exists idx_pricing_rules_plan on public.pricing_rules(plan_id);

-- 10) Add-ons
create table if not exists public.add_ons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  price_cents int not null,
  price_type text not null default 'FIXED' check (price_type in ('FIXED','PER_DOG','PER_VISIT')),
  is_recurring boolean not null default false,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_add_ons_org on public.add_ons(org_id);

-- 11) Subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  plan_id uuid not null references public.service_plans(id) on delete restrict,
  stripe_subscription_id text unique,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','CANCELED','PAST_DUE')),
  frequency text not null check (frequency in ('WEEKLY','BIWEEKLY','MONTHLY','ONETIME')),
  preferred_day text check (preferred_day in ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY')),
  price_per_visit_cents int not null,
  billing_day int,
  next_service_date date,
  pause_start_date date,
  pause_end_date date,
  canceled_at timestamptz,
  cancel_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_client on public.subscriptions(client_id);
create index if not exists idx_subscriptions_location on public.subscriptions(location_id);
create index if not exists idx_subscriptions_status on public.subscriptions(org_id, status);
create index if not exists idx_subscriptions_stripe on public.subscriptions(stripe_subscription_id);

-- 12) Subscription Add-ons
create table if not exists public.subscription_add_ons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  add_on_id uuid not null references public.add_ons(id) on delete restrict,
  quantity int not null default 1,
  price_cents int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_subscription_add_ons_sub on public.subscription_add_ons(subscription_id);

-- 13) Coupons
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  description text,
  discount_type text not null check (discount_type in ('PERCENTAGE','FIXED_AMOUNT','FREE_VISITS')),
  discount_value int not null,
  max_uses int,
  current_uses int not null default 0,
  min_purchase_cents int,
  applies_to text not null default 'ALL' check (applies_to in ('ALL','FIRST_VISIT','RECURRING')),
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, code)
);
create index if not exists idx_coupons_org_code on public.coupons(org_id, code);

-- =====================================================
-- OPERATIONS TABLES
-- =====================================================

-- 14) Jobs (individual service visits)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  client_id uuid not null references public.clients(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  route_id uuid,
  route_order int,
  scheduled_date date not null,
  scheduled_time_start time,
  scheduled_time_end time,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','EN_ROUTE','IN_PROGRESS','COMPLETED','SKIPPED','CANCELED')),
  skip_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_minutes int,
  price_cents int not null,
  notes text,
  internal_notes text,
  photos text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_jobs_subscription on public.jobs(subscription_id);
create index if not exists idx_jobs_client on public.jobs(client_id);
create index if not exists idx_jobs_location on public.jobs(location_id);
create index if not exists idx_jobs_assigned on public.jobs(assigned_to);
create index if not exists idx_jobs_date_status on public.jobs(org_id, scheduled_date, status);
create index if not exists idx_jobs_route on public.jobs(route_id);

-- 15) Job Add-ons
create table if not exists public.job_add_ons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  add_on_id uuid not null references public.add_ons(id) on delete restrict,
  quantity int not null default 1,
  price_cents int not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_job_add_ons_job on public.job_add_ons(job_id);

-- 16) Routes (daily route assignments)
create table if not exists public.routes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  route_date date not null,
  name text,
  status text not null default 'PLANNED' check (status in ('PLANNED','IN_PROGRESS','COMPLETED')),
  start_time timestamptz,
  end_time timestamptz,
  start_odometer decimal(10, 1),
  end_odometer decimal(10, 1),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_routes_org_date on public.routes(org_id, route_date);
create index if not exists idx_routes_assigned on public.routes(assigned_to, route_date);

-- Add foreign key from jobs to routes (after routes table exists)
alter table public.jobs
  add constraint fk_jobs_route
  foreign key (route_id) references public.routes(id) on delete set null;

-- 17) Route Stops
create table if not exists public.route_stops (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  route_id uuid not null references public.routes(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  stop_order int not null,
  estimated_arrival time,
  actual_arrival timestamptz,
  created_at timestamptz not null default now(),
  unique (route_id, stop_order)
);
create index if not exists idx_route_stops_route on public.route_stops(route_id);

-- 18) Shifts (employee work periods)
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  route_id uuid references public.routes(id) on delete set null,
  shift_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  start_odometer decimal(10, 1),
  end_odometer decimal(10, 1),
  vehicle_type text,
  status text not null default 'SCHEDULED' check (status in ('SCHEDULED','CLOCKED_IN','ON_BREAK','CLOCKED_OUT')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_shifts_user_date on public.shifts(user_id, shift_date);
create index if not exists idx_shifts_org_date on public.shifts(org_id, shift_date);

-- 19) Shift Breaks
create table if not exists public.shift_breaks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  break_start timestamptz not null,
  break_end timestamptz,
  break_type text not null default 'REGULAR' check (break_type in ('REGULAR','LUNCH','OTHER')),
  created_at timestamptz not null default now()
);
create index if not exists idx_shift_breaks_shift on public.shift_breaks(shift_id);

-- =====================================================
-- BILLING TABLES
-- =====================================================

-- 20) Invoices
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  stripe_invoice_id text unique,
  invoice_number text not null,
  status text not null default 'DRAFT' check (status in ('DRAFT','OPEN','PAID','VOID','UNCOLLECTIBLE')),
  subtotal_cents int not null default 0,
  discount_cents int not null default 0,
  tax_cents int not null default 0,
  total_cents int not null default 0,
  amount_paid_cents int not null default 0,
  amount_due_cents int not null default 0,
  currency text not null default 'usd',
  due_date date,
  paid_at timestamptz,
  voided_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_invoices_client on public.invoices(client_id);
create index if not exists idx_invoices_status on public.invoices(org_id, status);
create index if not exists idx_invoices_stripe on public.invoices(stripe_invoice_id);

-- 21) Invoice Items
create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  description text not null,
  quantity int not null default 1,
  unit_price_cents int not null,
  total_cents int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_invoice_items_invoice on public.invoice_items(invoice_id);

-- 22) Payments
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  amount_cents int not null,
  currency text not null default 'usd',
  status text not null check (status in ('PENDING','SUCCEEDED','FAILED','REFUNDED','PARTIALLY_REFUNDED')),
  payment_method text,
  failure_reason text,
  refunded_amount_cents int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payments_client on public.payments(client_id);
create index if not exists idx_payments_invoice on public.payments(invoice_id);
create index if not exists idx_payments_stripe on public.payments(stripe_payment_intent_id);

-- =====================================================
-- COMMUNICATION TABLES
-- =====================================================

-- 23) Notification Templates
create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  type text not null check (type in ('ON_THE_WAY','DAY_AHEAD','COMPLETED','SKIPPED','OFF_SCHEDULE','PAYMENT_FAILED','WELCOME','REMARKETING_SMS','REMARKETING_EMAIL')),
  channel text not null check (channel in ('SMS','EMAIL')),
  name text not null,
  subject text,
  body text not null,
  is_enabled boolean not null default true,
  variables jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, type, channel)
);
create index if not exists idx_notification_templates_org_type on public.notification_templates(org_id, type);

-- 24) Message Conversations
create table if not exists public.message_conversations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  contact_id uuid references public.client_contacts(id) on delete set null,
  location_id uuid references public.locations(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  staff_id uuid references public.users(id) on delete set null,
  channel text not null check (channel in ('SMS','EMAIL')),
  participant_our text not null,
  participant_their text not null,
  status text not null default 'OPEN' check (status in ('OPEN','CLOSED','ARCHIVED')),
  last_message_at timestamptz,
  unread_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_msg_convos_org on public.message_conversations(org_id);
create index if not exists idx_msg_convos_client on public.message_conversations(client_id);
create index if not exists idx_msg_convos_last on public.message_conversations(org_id, last_message_at desc);

-- 25) Messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.message_conversations(id) on delete cascade,
  direction text not null check (direction in ('INBOUND','OUTBOUND')),
  body text not null,
  status text not null default 'QUEUED' check (status in ('QUEUED','SENT','DELIVERED','FAILED','READ')),
  provider text not null default 'twilio',
  provider_id text,
  sent_by uuid references public.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_convo on public.messages(conversation_id, created_at desc);

-- 26) Reply Forwarding Rules
create table if not exists public.reply_forwarding_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  is_enabled boolean not null default true,
  forward_to_type text not null check (forward_to_type in ('SMS','EMAIL')),
  forward_to_value text not null,
  conditions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_reply_forwarding_org on public.reply_forwarding_rules(org_id);

-- 27) Notifications (queue/log)
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  template_id uuid references public.notification_templates(id) on delete set null,
  channel text not null check (channel in ('SMS','EMAIL')),
  recipient text not null,
  subject text,
  body text not null,
  status text not null default 'PENDING' check (status in ('PENDING','SENT','DELIVERED','FAILED','CANCELED')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  delivered_at timestamptz,
  error_message text,
  provider_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_client on public.notifications(client_id);
create index if not exists idx_notifications_status on public.notifications(org_id, status);
create index if not exists idx_notifications_scheduled on public.notifications(scheduled_for) where status = 'PENDING';

-- =====================================================
-- MARKETING TABLES
-- =====================================================

-- 28) Onboarding Sessions (partial submission tracking)
create table if not exists public.onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS','COMPLETED','ABANDONED')),
  current_step text,
  in_service_area boolean,
  zip text,
  contact_name text,
  contact_email text,
  contact_phone text,
  address jsonb not null default '{}'::jsonb,
  pricing_snapshot jsonb not null default '{}'::jsonb,
  selected_plan_snapshot jsonb not null default '{}'::jsonb,
  dog_count int,
  frequency text,
  utm jsonb not null default '{}'::jsonb,
  referral_code text,
  converted_client_id uuid references public.clients(id) on delete set null,
  last_activity_at timestamptz not null default now(),
  abandoned_at timestamptz,
  remarketing_sent_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_onboarding_sessions_org_status on public.onboarding_sessions(org_id, status);
create index if not exists idx_onboarding_sessions_abandoned on public.onboarding_sessions(org_id, status, last_activity_at) where status = 'IN_PROGRESS';

-- 29) Onboarding Events (funnel analytics)
create table if not exists public.onboarding_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.onboarding_sessions(id) on delete cascade,
  event_type text not null,
  step text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_onboarding_events_session on public.onboarding_events(session_id);

-- 30) Marketing Integrations
create table if not exists public.marketing_integrations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('MAILCHIMP','EZTEXTING','DIRECT_MAIL','WEBHOOK_GENERIC')),
  name text not null,
  is_enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_marketing_integrations_org on public.marketing_integrations(org_id);

-- 31) Marketing Sync Events
create table if not exists public.marketing_sync_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid references public.marketing_integrations(id) on delete set null,
  provider text not null,
  event_type text not null check (event_type in ('ONETIME_SIGNUP','RECURRING_SIGNUP','PARTIAL_SUBMISSION','CANCELED_CLIENT','ONETIME_JOB_COMPLETED')),
  contact jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  status text not null default 'PENDING' check (status in ('PENDING','SUCCESS','FAILED')),
  error text,
  attempt_count int not null default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_marketing_sync_status on public.marketing_sync_events(org_id, provider, status);

-- =====================================================
-- FEATURE TABLES
-- =====================================================

-- 32) Gift Certificates
create table if not exists public.gift_certificates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  code text not null unique,
  initial_value_cents int not null,
  balance_cents int not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','REDEEMED','EXPIRED','CANCELED')),
  expires_at date,
  purchaser_name text,
  purchaser_email text,
  purchaser_phone text,
  recipient_name text,
  recipient_email text,
  message text,
  delivered_at timestamptz,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_gift_certificates_org on public.gift_certificates(org_id);
create index if not exists idx_gift_certificates_code on public.gift_certificates(code);

-- 33) Gift Certificate Redemptions
create table if not exists public.gift_certificate_redemptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  gift_certificate_id uuid not null references public.gift_certificates(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  invoice_id uuid references public.invoices(id) on delete set null,
  amount_cents int not null,
  redeemed_at timestamptz not null default now()
);
create index if not exists idx_gift_redemptions_cert on public.gift_certificate_redemptions(gift_certificate_id);
create index if not exists idx_gift_redemptions_client on public.gift_certificate_redemptions(client_id);

-- 34) Referral Program Settings
create table if not exists public.referral_program_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  is_enabled boolean not null default true,
  reward_referrer_cents int not null default 2500,
  reward_referee_cents int not null default 2500,
  reward_type text not null default 'ACCOUNT_CREDIT' check (reward_type in ('ACCOUNT_CREDIT','COUPON')),
  coupon_id uuid references public.coupons(id) on delete set null,
  terms text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 35) Referrals
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  referrer_client_id uuid references public.clients(id) on delete set null,
  referrer_name text,
  referrer_email text,
  referrer_phone text,
  referee_name text,
  referee_email text,
  referee_phone text,
  referral_code text not null,
  status text not null default 'NEW' check (status in ('NEW','INVITED','SIGNED_UP','REWARDED','CLOSED')),
  converted_client_id uuid references public.clients(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_referrals_org on public.referrals(org_id);
create index if not exists idx_referrals_referrer on public.referrals(referrer_client_id);
create index if not exists idx_referrals_code on public.referrals(referral_code);

-- 36) Referral Rewards
create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  referral_id uuid not null references public.referrals(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  amount_cents int not null,
  reward_type text not null check (reward_type in ('ACCOUNT_CREDIT','COUPON')),
  coupon_id uuid references public.coupons(id) on delete set null,
  issued_at timestamptz not null default now(),
  redeemed_at timestamptz
);
create index if not exists idx_referral_rewards_referral on public.referral_rewards(referral_id);
create index if not exists idx_referral_rewards_client on public.referral_rewards(client_id);

-- 37) Account Credits
create table if not exists public.account_credits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  amount_cents int not null,
  reason text,
  source_type text not null check (source_type in ('REFERRAL','GIFT','ADJUSTMENT','REFUND','PROMO')),
  source_id uuid,
  applied_to_invoice_id uuid references public.invoices(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_account_credits_client on public.account_credits(client_id);

-- 38) Zip Frequency Restrictions (Zip Guard)
create table if not exists public.zip_frequency_restrictions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  zip text not null,
  blocked_frequencies text[] not null default '{}',
  blocked_plan_ids uuid[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, zip)
);
create index if not exists idx_zip_restrictions_org_zip on public.zip_frequency_restrictions(org_id, zip);

-- =====================================================
-- SYSTEM TABLES
-- =====================================================

-- 39) Leads (unified lead storage)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  source text not null check (source in ('QUOTE_FORM','OUT_OF_AREA','COMMERCIAL','AD_LEAD','REFERRAL','OTHER')),
  status text not null default 'NEW' check (status in ('NEW','CONTACTED','QUALIFIED','CONVERTED','LOST')),
  first_name text,
  last_name text,
  email text,
  phone text,
  company_name text,
  zip_code text,
  city text,
  state text,
  address jsonb not null default '{}'::jsonb,
  dog_count int,
  frequency text,
  notes text,
  tags text[] not null default '{}',
  utm jsonb not null default '{}'::jsonb,
  ad_source text,
  campaign_name text,
  referral_code text,
  custom_fields jsonb not null default '{}'::jsonb,
  converted_client_id uuid references public.clients(id) on delete set null,
  assigned_to uuid references public.users(id) on delete set null,
  last_contacted_at timestamptz,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_leads_org_status on public.leads(org_id, status);
create index if not exists idx_leads_source on public.leads(org_id, source);
create index if not exists idx_leads_email on public.leads(email);
create index if not exists idx_leads_phone on public.leads(phone);

-- 40) Audit Log
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_audit_log_org on public.audit_log(org_id, created_at desc);
create index if not exists idx_audit_log_entity on public.audit_log(entity_type, entity_id);

-- 41) Webhooks
create table if not exists public.webhooks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  url text not null,
  secret text,
  events text[] not null default '{}',
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_webhooks_org on public.webhooks(org_id);

-- 42) Webhook Deliveries
create table if not exists public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  webhook_id uuid not null references public.webhooks(id) on delete cascade,
  event_type text not null,
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING','SUCCESS','FAILED')),
  response_status int,
  response_body text,
  attempt_count int not null default 0,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_webhook_deliveries_webhook on public.webhook_deliveries(webhook_id);
create index if not exists idx_webhook_deliveries_status on public.webhook_deliveries(status) where status = 'PENDING';

-- 43) Inbound Messages
create table if not exists public.inbound_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.organizations(id) on delete set null,
  channel text not null check (channel in ('SMS','EMAIL')),
  from_address text not null,
  to_address text not null,
  subject text,
  body text not null,
  provider text not null,
  provider_id text,
  matched_client_id uuid references public.clients(id) on delete set null,
  matched_conversation_id uuid references public.message_conversations(id) on delete set null,
  processed boolean not null default false,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_inbound_messages_from on public.inbound_messages(from_address);
create index if not exists idx_inbound_messages_processed on public.inbound_messages(processed) where not processed;

-- 44) Public Metrics Cache (PetYard Tracker)
create table if not exists public.public_metrics_cache (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  satisfied_customers int not null default 0,
  happy_pets int not null default 0,
  completed_yards int not null default 0,
  five_star_reviews int not null default 0,
  computed_at timestamptz not null default now()
);

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================

create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Apply trigger to all tables with updated_at
do $$
declare
  t text;
begin
  for t in
    select table_name
    from information_schema.columns
    where table_schema = 'public'
      and column_name = 'updated_at'
      and table_name not in ('schema_migrations')
  loop
    execute format('
      drop trigger if exists update_%I_updated_at on public.%I;
      create trigger update_%I_updated_at
        before update on public.%I
        for each row execute function public.update_updated_at_column();
    ', t, t, t, t);
  end loop;
end;
$$ language plpgsql;

-- =====================================================
-- RLS POLICIES (Basic - expand as needed)
-- =====================================================

-- Enable RLS on all tables
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.locations enable row level security;
alter table public.dogs enable row level security;
alter table public.service_plans enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.add_ons enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_add_ons enable row level security;
alter table public.coupons enable row level security;
alter table public.jobs enable row level security;
alter table public.job_add_ons enable row level security;
alter table public.routes enable row level security;
alter table public.route_stops enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_breaks enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;
alter table public.payments enable row level security;
alter table public.notification_templates enable row level security;
alter table public.message_conversations enable row level security;
alter table public.messages enable row level security;
alter table public.reply_forwarding_rules enable row level security;
alter table public.notifications enable row level security;
alter table public.onboarding_sessions enable row level security;
alter table public.onboarding_events enable row level security;
alter table public.marketing_integrations enable row level security;
alter table public.marketing_sync_events enable row level security;
alter table public.gift_certificates enable row level security;
alter table public.gift_certificate_redemptions enable row level security;
alter table public.referral_program_settings enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.account_credits enable row level security;
alter table public.zip_frequency_restrictions enable row level security;
alter table public.leads enable row level security;
alter table public.audit_log enable row level security;
alter table public.webhooks enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.inbound_messages enable row level security;
alter table public.public_metrics_cache enable row level security;

-- Helper function to get user's org_id
create or replace function public.get_user_org_id()
returns uuid as $$
  select org_id from public.users where id = auth.uid();
$$ language sql security definer;

-- Helper function to get user's role
create or replace function public.get_user_role()
returns text as $$
  select role from public.users where id = auth.uid();
$$ language sql security definer;

-- Basic org-scoped policies for staff users
-- Organizations: staff can view their own org
create policy "Staff can view own organization"
  on public.organizations for select
  using (id = public.get_user_org_id());

-- Users: staff can view users in their org
create policy "Staff can view org users"
  on public.users for select
  using (org_id = public.get_user_org_id());

-- Clients: staff can view clients in their org
create policy "Staff can view org clients"
  on public.clients for select
  using (org_id = public.get_user_org_id());

create policy "Staff can insert clients"
  on public.clients for insert
  with check (org_id = public.get_user_org_id());

create policy "Staff can update clients"
  on public.clients for update
  using (org_id = public.get_user_org_id());

-- Client portal: clients can view their own data
create policy "Clients can view own data"
  on public.clients for select
  using (
    public.get_user_role() = 'CLIENT'
    and user_id = auth.uid()
  );

-- Jobs: staff can manage jobs in their org
create policy "Staff can view org jobs"
  on public.jobs for select
  using (org_id = public.get_user_org_id());

create policy "Staff can insert jobs"
  on public.jobs for insert
  with check (org_id = public.get_user_org_id());

create policy "Staff can update jobs"
  on public.jobs for update
  using (org_id = public.get_user_org_id());

-- Public metrics: anyone can read (for public widget)
create policy "Public can read metrics"
  on public.public_metrics_cache for select
  using (true);

-- Service role bypass for all tables (for server-side operations)
create policy "Service role has full access to organizations"
  on public.organizations for all
  using (auth.role() = 'service_role');
