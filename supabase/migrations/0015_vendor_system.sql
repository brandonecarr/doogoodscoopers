-- 0015: Vendor System
-- Adds vendor management: profiles, services, add-on links, and payouts

-- 1) Vendors
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  contact_name text,
  email text,
  phone text,
  website text,
  address jsonb not null default '{}'::jsonb,
  payout_method text not null default 'CHECK'
    check (payout_method in ('CHECK','ACH','VENMO','PAYPAL','OTHER')),
  payout_details jsonb not null default '{}'::jsonb,
  commission_type text not null default 'PERCENTAGE'
    check (commission_type in ('PERCENTAGE','FIXED_AMOUNT')),
  commission_value int not null default 0,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vendors_org on public.vendors(org_id);
create index if not exists idx_vendors_active on public.vendors(org_id, is_active);

-- 2) Vendor Services
create table if not exists public.vendor_services (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  name text not null,
  description text,
  vendor_cost_cents int not null,
  cost_type text not null default 'FIXED'
    check (cost_type in ('FIXED','PER_VISIT')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vendor_services_vendor on public.vendor_services(vendor_id);
create index if not exists idx_vendor_services_org on public.vendor_services(org_id);

-- 3) Add-On Vendor Links (many-to-many: an add-on can have multiple vendors)
create table if not exists public.add_on_vendor_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  add_on_id uuid not null references public.add_ons(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  vendor_service_id uuid references public.vendor_services(id) on delete set null,
  vendor_cost_cents int not null,
  is_default boolean not null default false,
  service_area_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, add_on_id, vendor_id)
);
create index if not exists idx_add_on_vendor_links_addon on public.add_on_vendor_links(add_on_id);
create index if not exists idx_add_on_vendor_links_vendor on public.add_on_vendor_links(vendor_id);

-- 4) Vendor Payouts
create table if not exists public.vendor_payouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  amount_cents int not null,
  status text not null default 'PENDING'
    check (status in ('PENDING','PAID','CANCELED')),
  payout_method text,
  reference_number text,
  period_start date not null,
  period_end date not null,
  notes text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_vendor_payouts_vendor on public.vendor_payouts(vendor_id);
create index if not exists idx_vendor_payouts_org on public.vendor_payouts(org_id);
create index if not exists idx_vendor_payouts_status on public.vendor_payouts(org_id, status);

-- 5) Vendor Payout Items
create table if not exists public.vendor_payout_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vendor_payout_id uuid not null references public.vendor_payouts(id) on delete cascade,
  job_add_on_id uuid references public.job_add_ons(id) on delete set null,
  description text not null,
  amount_cents int not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_vendor_payout_items_payout on public.vendor_payout_items(vendor_payout_id);

-- RLS
alter table public.vendors enable row level security;
alter table public.vendor_services enable row level security;
alter table public.add_on_vendor_links enable row level security;
alter table public.vendor_payouts enable row level security;
alter table public.vendor_payout_items enable row level security;

-- Service role full access
create policy "Service role has full access to vendors"
  on public.vendors for all using (auth.role() = 'service_role');
create policy "Service role has full access to vendor_services"
  on public.vendor_services for all using (auth.role() = 'service_role');
create policy "Service role has full access to add_on_vendor_links"
  on public.add_on_vendor_links for all using (auth.role() = 'service_role');
create policy "Service role has full access to vendor_payouts"
  on public.vendor_payouts for all using (auth.role() = 'service_role');
create policy "Service role has full access to vendor_payout_items"
  on public.vendor_payout_items for all using (auth.role() = 'service_role');

-- updated_at triggers
do $$
declare
  t text;
begin
  for t in
    select unnest(ARRAY['vendors','vendor_services','add_on_vendor_links','vendor_payouts'])
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
