-- Migration: 0011_credit_card_links
-- Description: Temporary links for clients to add credit cards via Stripe

create table if not exists public.credit_card_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_card_links_token on public.credit_card_links(token);
create index if not exists idx_credit_card_links_client on public.credit_card_links(client_id);
create index if not exists idx_credit_card_links_expires on public.credit_card_links(expires_at);
