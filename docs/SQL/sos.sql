-- SOS/Emergency system with proper role-based access control

-- 1) User roles enum and table (proper RBAC instead of checking profile names)
create type public.app_role as enum ('admin', 'moderator', 'driver', 'user');

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz default now(),
  unique(user_id, role)
);

alter table public.user_roles enable row level security;

create policy "user_roles_select_own" on public.user_roles
  for select using (user_id = auth.uid());

-- Security definer function to check roles (prevents RLS recursion)
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role = _role
  )
$$;

-- 2) SOS events table
create table if not exists public.sos_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  hazard text check (hazard in ('accident','medical','robbery','breakdown','other')) default 'other',
  message text,
  photo_url text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz default now(),
  acknowledged_by uuid references auth.users(id),
  acknowledged_at timestamptz,
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  resolved_note text,
  status text check (status in ('open','acknowledged','resolved','cancelled')) default 'open'
);

create index if not exists sos_user_idx on public.sos_events(user_id, created_at desc);
create index if not exists sos_status_idx on public.sos_events(status, created_at desc);
create index if not exists sos_location_idx on public.sos_events(latitude, longitude);

alter table public.sos_events enable row level security;

-- RLS: drivers see/create own; admins see all
create policy "sos_select_own_or_admin" on public.sos_events
  for select using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "sos_insert_self" on public.sos_events
  for insert with check (user_id = auth.uid());

create policy "sos_update_admin" on public.sos_events
  for update using (public.has_role(auth.uid(), 'admin'));

-- 3) SOS position updates table (for tracking driver location while SOS active)
create table if not exists public.sos_position_updates (
  id uuid primary key default gen_random_uuid(),
  sos_event_id uuid not null references public.sos_events(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  timestamp timestamptz default now()
);

create index if not exists sos_position_event_idx on public.sos_position_updates(sos_event_id, timestamp desc);

alter table public.sos_position_updates enable row level security;

create policy "sos_position_select_event_owner_or_admin" on public.sos_position_updates
  for select using (
    exists(select 1 from public.sos_events e where e.id = sos_event_id and (e.user_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
  );

create policy "sos_position_insert_event_owner" on public.sos_position_updates
  for insert with check (
    exists(select 1 from public.sos_events e where e.id = sos_event_id and e.user_id = auth.uid())
  );

-- Add to realtime
alter publication supabase_realtime add table public.sos_events;
alter publication supabase_realtime add table public.sos_position_updates;

-- Grant admin role to first user (modify as needed)
-- insert into public.user_roles (user_id, role) values ('YOUR_USER_ID', 'admin');
