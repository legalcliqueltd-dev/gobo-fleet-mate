-- Enable UUID generator
create extension if not exists pgcrypto;

-- Devices table
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text,
  imei text unique,
  status text check (status in ('active','idle','offline')) default 'offline',
  created_at timestamptz default now()
);
create index if not exists devices_user_id_idx on public.devices(user_id);
alter table public.devices enable row level security;

-- Devices RLS: owners only
create policy "devices_select_own" on public.devices
  for select using (auth.uid() = user_id);
create policy "devices_insert_own" on public.devices
  for insert with check (auth.uid() = user_id);
create policy "devices_update_own" on public.devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "devices_delete_own" on public.devices
  for delete using (auth.uid() = user_id);

-- Locations table
create table if not exists public.locations (
  id bigserial primary key,
  device_id uuid not null references public.devices(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  speed double precision,
  timestamp timestamptz not null default now()
);
create index if not exists locations_device_time_idx on public.locations(device_id, timestamp desc);
alter table public.locations enable row level security;

-- Locations RLS: rows visible only for devices owned by current user
create policy "locations_select_owner_devices" on public.locations
  for select using (
    exists (
      select 1 from public.devices d
      where d.id = locations.device_id and d.user_id = auth.uid()
    )
  );

-- Allow inserts/updates for device owners (dev/testing).
-- In production, prefer server-side writes with service role.
create policy "locations_insert_owner_devices" on public.locations
  for insert with check (
    exists (
      select 1 from public.devices d
      where d.id = locations.device_id and d.user_id = auth.uid()
    )
  );
create policy "locations_update_owner_devices" on public.locations
  for update using (
    exists (
      select 1 from public.devices d
      where d.id = locations.device_id and d.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.devices d
      where d.id = locations.device_id and d.user_id = auth.uid()
    )
  );

-- Enable realtime replication
alter publication supabase_realtime add table public.locations;
