-- Migration: Staff Location Tracking
-- Adds real-time location tracking for field staff

-- Staff location updates table
create table if not exists public.staff_locations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  lat decimal(10, 7) not null,
  lng decimal(10, 7) not null,
  accuracy decimal(8, 2), -- GPS accuracy in meters
  heading decimal(5, 2), -- Direction of travel in degrees
  speed decimal(6, 2), -- Speed in m/s
  altitude decimal(8, 2), -- Altitude in meters
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  -- Add metadata for additional context
  metadata jsonb default '{}'::jsonb
);

-- Index for quick lookups by user
create index if not exists idx_staff_locations_user on public.staff_locations(user_id, recorded_at desc);

-- Index for org-wide queries
create index if not exists idx_staff_locations_org on public.staff_locations(org_id, recorded_at desc);

-- Current location view (most recent location per user)
create or replace view public.current_staff_locations as
select distinct on (user_id)
  sl.id,
  sl.org_id,
  sl.user_id,
  u.first_name,
  u.last_name,
  u.email,
  sp.vehicle_type,
  sl.lat,
  sl.lng,
  sl.accuracy,
  sl.heading,
  sl.speed,
  sl.recorded_at,
  -- Calculate if location is stale (older than 5 minutes)
  case when sl.recorded_at < now() - interval '5 minutes' then true else false end as is_stale
from public.staff_locations sl
join public.users u on sl.user_id = u.id
left join public.staff_profiles sp on sl.user_id = sp.user_id
order by user_id, recorded_at desc;

-- RLS policies
alter table public.staff_locations enable row level security;

-- Users can insert their own locations
create policy "Users can insert own location" on public.staff_locations
  for insert with check (auth.uid() = user_id);

-- Users can view locations for their org
create policy "Users can view org locations" on public.staff_locations
  for select using (
    org_id in (
      select org_id from public.users where id = auth.uid()
    )
  );

-- Clean up old location data (keep last 7 days)
-- This would typically be run by a scheduled job
create or replace function public.cleanup_old_staff_locations()
returns integer as $$
declare
  deleted_count integer;
begin
  delete from public.staff_locations
  where recorded_at < now() - interval '7 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$ language plpgsql security definer;

-- Grant execute to authenticated users (for admin cleanup)
grant execute on function public.cleanup_old_staff_locations() to authenticated;

comment on table public.staff_locations is 'Real-time GPS location tracking for field staff';
comment on view public.current_staff_locations is 'Most recent location for each staff member';
