-- 0017: Client Cross-Sells
-- Stores cross-sell assignments per client with optional vendor assignment

create table if not exists public.client_cross_sells (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  cross_sell_id text not null,  -- UUID stored as text since cross-sells are JSONB items
  cross_sell_type text not null default 'RESIDENTIAL' check (cross_sell_type in ('RESIDENTIAL','COMMERCIAL')),
  name text not null,
  description text,
  unit text,
  price_per_unit_cents int not null,
  quantity int not null default 1,
  vendor_id uuid references public.vendors(id) on delete set null,
  vendor_cost_cents int,
  status text not null default 'ACTIVE' check (status in ('ACTIVE','PAUSED','CANCELED')),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_client_cross_sells_client on public.client_cross_sells(client_id);
create index if not exists idx_client_cross_sells_org on public.client_cross_sells(org_id);
create index if not exists idx_client_cross_sells_vendor on public.client_cross_sells(vendor_id);
create index if not exists idx_client_cross_sells_cross_sell on public.client_cross_sells(cross_sell_id);

-- RLS
alter table public.client_cross_sells enable row level security;

create policy "Service role has full access to client_cross_sells"
  on public.client_cross_sells for all using (auth.role() = 'service_role');

-- updated_at trigger
drop trigger if exists update_client_cross_sells_updated_at on public.client_cross_sells;
create trigger update_client_cross_sells_updated_at
  before update on public.client_cross_sells
  for each row execute function public.update_updated_at_column();
