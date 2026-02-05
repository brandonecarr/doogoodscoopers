-- Add is_default column to coupons table
-- Only one coupon per org can be the default

alter table public.coupons
  add column if not exists is_default boolean not null default false;

-- Create a partial unique index to ensure only one default coupon per org
create unique index if not exists idx_coupons_org_default
  on public.coupons (org_id)
  where (is_default = true);

-- Create index for faster lookups
create index if not exists idx_coupons_is_default on public.coupons(org_id, is_default);
