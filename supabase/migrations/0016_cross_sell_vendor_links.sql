-- 0016: Cross-Sell Vendor Links
-- Links cross-sells (JSONB items in organizations.settings) to vendors

create table if not exists public.cross_sell_vendor_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  cross_sell_id text not null,  -- UUID stored as text since cross-sells are JSONB items
  cross_sell_type text not null check (cross_sell_type in ('RESIDENTIAL','COMMERCIAL')),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  vendor_service_id uuid references public.vendor_services(id) on delete set null,
  vendor_cost_cents int not null,
  is_default boolean not null default false,
  service_area_notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, cross_sell_id, vendor_id)
);

create index if not exists idx_cross_sell_vendor_links_cross_sell on public.cross_sell_vendor_links(cross_sell_id);
create index if not exists idx_cross_sell_vendor_links_vendor on public.cross_sell_vendor_links(vendor_id);
create index if not exists idx_cross_sell_vendor_links_org on public.cross_sell_vendor_links(org_id);

-- RLS
alter table public.cross_sell_vendor_links enable row level security;

create policy "Service role has full access to cross_sell_vendor_links"
  on public.cross_sell_vendor_links for all using (auth.role() = 'service_role');

-- updated_at trigger
drop trigger if exists update_cross_sell_vendor_links_updated_at on public.cross_sell_vendor_links;
create trigger update_cross_sell_vendor_links_updated_at
  before update on public.cross_sell_vendor_links
  for each row execute function public.update_updated_at_column();
