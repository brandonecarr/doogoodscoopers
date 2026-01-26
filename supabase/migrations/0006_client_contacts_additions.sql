-- Migration: 0006_client_contacts_additions
-- Description: Add middle_name and cell_phone columns to client_contacts

-- Add middle_name column
alter table public.client_contacts
  add column if not exists middle_name text;

-- Rename phone to home_phone for clarity and add cell_phone
alter table public.client_contacts
  rename column phone to home_phone;

alter table public.client_contacts
  add column if not exists cell_phone text;

-- Add receive_job_notifications and receive_invoices_email flags
-- These are more specific than the general notification_preferences jsonb
alter table public.client_contacts
  add column if not exists receive_job_notifications boolean not null default false;

alter table public.client_contacts
  add column if not exists receive_invoices_email boolean not null default false;
