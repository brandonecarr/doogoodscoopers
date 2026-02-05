-- Rename invoice status UNCOLLECTIBLE to FAILED
-- This is more user-friendly terminology

-- First, update any existing UNCOLLECTIBLE invoices to FAILED
update public.invoices set status = 'FAILED' where status = 'UNCOLLECTIBLE';

-- Drop the old constraint and add the new one
alter table public.invoices drop constraint if exists invoices_status_check;
alter table public.invoices add constraint invoices_status_check
  check (status in ('DRAFT','OPEN','PAID','VOID','FAILED'));
