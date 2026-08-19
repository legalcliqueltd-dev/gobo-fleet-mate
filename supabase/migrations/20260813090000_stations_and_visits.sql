-- ============================================================================
-- Stations, assignments and visit receipts
-- ============================================================================
-- Lets a manager tag real-world points on the map (dump site, depot, school
-- gate, receptacle) that a driver must physically attend — daily, weekly, or
-- once — and produces an auditable record that they were actually there.
--
-- Two facts are recorded SEPARATELY and deliberately:
--   1. arrival  — GPS put the driver inside the station radius long enough
--   2. receipt  — the driver submitted a live photo while there
-- Keeping them apart is the whole point: "was present but took no photo" is a
-- visible state, not a silent absence.
--
-- SAFE TO RE-RUN: every statement is guarded.
--
-- NOTE ON SECURITY MODEL: the driver app is intentionally unauthenticated —
-- drivers join with a connection code, not a Supabase login — so driver-facing
-- policies below are keyed on admin_code rather than auth.uid(), matching the
-- existing drivers / driver_locations / tasks tables. Manager-facing writes
-- are locked to the owning account. If drivers are ever moved onto Supabase
-- anonymous auth, these policies should be tightened to match.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. stations — the points a manager marks on the map
-- ---------------------------------------------------------------------------
create table if not exists public.stations (
  id                uuid primary key default gen_random_uuid(),
  admin_user_id     uuid not null references auth.users (id) on delete cascade,
  admin_code        text not null,

  name              text not null,
  -- Drives the marker glyph on both maps: dump_site | pickup | dropoff |
  -- school | depot | checkpoint | custom
  kind              text not null default 'checkpoint',
  color             text not null default '#2563eb',
  notes             text,

  latitude          double precision not null,
  longitude         double precision not null,

  -- Arrival rule. 75m / 60s is the default: phone GPS is accurate to roughly
  -- 5-20m and much worse between buildings, so a tighter radius would miss
  -- genuine visits. The dwell requirement is what stops a driver who merely
  -- drives past on the road from being credited with a visit.
  radius_m          integer not null default 75,
  min_dwell_seconds integer not null default 60,

  requires_photo    boolean not null default true,

  -- daily | weekly | once | none
  recurrence        text not null default 'daily',
  -- Only meaningful when recurrence = 'weekly'. 0 = Sunday .. 6 = Saturday.
  recurrence_days   smallint[],
  -- Optional time-of-day window the visit must fall inside.
  window_start      time,
  window_end        time,

  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint stations_radius_sane check (radius_m between 20 and 2000),
  constraint stations_dwell_sane check (min_dwell_seconds between 0 and 3600),
  constraint stations_lat_range check (latitude between -90 and 90),
  constraint stations_lng_range check (longitude between -180 and 180),
  constraint stations_recurrence_valid
    check (recurrence in ('daily', 'weekly', 'once', 'none'))
);

create index if not exists stations_admin_code_idx on public.stations (admin_code);
create index if not exists stations_admin_user_idx on public.stations (admin_user_id);
create index if not exists stations_active_idx on public.stations (admin_code, active);

-- ---------------------------------------------------------------------------
-- 2. station_assignments — which drivers owe which stations
-- ---------------------------------------------------------------------------
-- A station with no assignments applies to every driver on that admin_code;
-- adding rows narrows it to specific drivers.
create table if not exists public.station_assignments (
  id         uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.stations (id) on delete cascade,
  driver_id  text not null,
  created_at timestamptz not null default now(),
  unique (station_id, driver_id)
);

create index if not exists station_assignments_driver_idx
  on public.station_assignments (driver_id);

-- ---------------------------------------------------------------------------
-- 3. station_visits — one row per driver per station per day
-- ---------------------------------------------------------------------------
create table if not exists public.station_visits (
  id                  uuid primary key default gen_random_uuid(),
  station_id          uuid not null references public.stations (id) on delete cascade,
  driver_id           text not null,
  admin_code          text not null,

  -- The day the visit belongs to, so "did he attend today?" is a lookup and
  -- a repeat pass on the same day updates rather than duplicates.
  visit_date          date not null default (now() at time zone 'utc')::date,

  arrived_at          timestamptz not null default now(),
  departed_at         timestamptz,
  dwell_seconds       integer,
  closest_distance_m  double precision,
  accuracy_m          double precision,

  -- The receipt. photo_* are only set once the driver actually submits one.
  photo_url           text,
  photo_submitted_at  timestamptz,
  photo_lat           double precision,
  photo_lng           double precision,
  photo_distance_m    double precision,

  -- arrived  — GPS confirmed presence, no receipt yet
  -- completed — presence AND receipt
  -- flagged   — recorded but something looks wrong (see flag_reason)
  status              text not null default 'arrived',
  flag_reason         text,

  created_at          timestamptz not null default now(),

  constraint station_visits_status_valid
    check (status in ('arrived', 'completed', 'flagged'))
);

-- One record per station per driver per day.
create unique index if not exists station_visits_unique_per_day
  on public.station_visits (station_id, driver_id, visit_date);

create index if not exists station_visits_driver_date_idx
  on public.station_visits (driver_id, visit_date desc);
create index if not exists station_visits_station_date_idx
  on public.station_visits (station_id, visit_date desc);
create index if not exists station_visits_admin_code_idx
  on public.station_visits (admin_code, visit_date desc);

-- ---------------------------------------------------------------------------
-- 4. Row level security
-- ---------------------------------------------------------------------------
alter table public.stations            enable row level security;
alter table public.station_assignments enable row level security;
alter table public.station_visits      enable row level security;

-- --- stations -------------------------------------------------------------
drop policy if exists "stations readable" on public.stations;
create policy "stations readable"
  on public.stations for select
  using (true);  -- drivers are unauthenticated; the app filters by admin_code

drop policy if exists "stations owner insert" on public.stations;
create policy "stations owner insert"
  on public.stations for insert
  with check (auth.uid() = admin_user_id);

drop policy if exists "stations owner update" on public.stations;
create policy "stations owner update"
  on public.stations for update
  using (auth.uid() = admin_user_id)
  with check (auth.uid() = admin_user_id);

drop policy if exists "stations owner delete" on public.stations;
create policy "stations owner delete"
  on public.stations for delete
  using (auth.uid() = admin_user_id);

-- --- station_assignments --------------------------------------------------
drop policy if exists "assignments readable" on public.station_assignments;
create policy "assignments readable"
  on public.station_assignments for select
  using (true);

drop policy if exists "assignments owner write" on public.station_assignments;
create policy "assignments owner write"
  on public.station_assignments for all
  using (
    exists (
      select 1 from public.stations s
      where s.id = station_assignments.station_id
        and s.admin_user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.stations s
      where s.id = station_assignments.station_id
        and s.admin_user_id = auth.uid()
    )
  );

-- --- station_visits -------------------------------------------------------
drop policy if exists "visits readable" on public.station_visits;
create policy "visits readable"
  on public.station_visits for select
  using (true);

-- Drivers are anonymous, so inserts cannot be tied to auth.uid(). They are
-- instead constrained to a station that genuinely exists and whose admin_code
-- matches the row being written — a fabricated admin_code is rejected.
drop policy if exists "visits driver insert" on public.station_visits;
create policy "visits driver insert"
  on public.station_visits for insert
  with check (
    exists (
      select 1 from public.stations s
      where s.id = station_visits.station_id
        and s.admin_code = station_visits.admin_code
        and s.active
    )
  );

-- Same rule for attaching the receipt to an existing arrival.
drop policy if exists "visits driver update" on public.station_visits;
create policy "visits driver update"
  on public.station_visits for update
  using (
    exists (
      select 1 from public.stations s
      where s.id = station_visits.station_id
        and s.admin_code = station_visits.admin_code
    )
  )
  with check (
    exists (
      select 1 from public.stations s
      where s.id = station_visits.station_id
        and s.admin_code = station_visits.admin_code
    )
  );

drop policy if exists "visits owner delete" on public.station_visits;
create policy "visits owner delete"
  on public.station_visits for delete
  using (
    exists (
      select 1 from public.stations s
      where s.id = station_visits.station_id
        and s.admin_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Storage bucket for the photo receipts
-- ---------------------------------------------------------------------------
-- Public-read, mirroring the existing 'proofs' and 'sos-evidence' buckets so
-- the manager can view receipts without signed-URL plumbing.
insert into storage.buckets (id, name, public)
values ('station-receipts', 'station-receipts', true)
on conflict (id) do nothing;

drop policy if exists "station receipts readable" on storage.objects;
create policy "station receipts readable"
  on storage.objects for select
  using (bucket_id = 'station-receipts');

drop policy if exists "station receipts uploadable" on storage.objects;
create policy "station receipts uploadable"
  on storage.objects for insert
  with check (bucket_id = 'station-receipts');

-- ---------------------------------------------------------------------------
-- 6. keep updated_at honest
-- ---------------------------------------------------------------------------
create or replace function public.touch_stations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stations_touch_updated_at on public.stations;
create trigger stations_touch_updated_at
  before update on public.stations
  for each row execute function public.touch_stations_updated_at();
