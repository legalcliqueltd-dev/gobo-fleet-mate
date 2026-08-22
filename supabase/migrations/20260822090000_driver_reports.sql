-- ============================================================================
-- Driver reports: shift-start vehicle checks and on-the-road problems
-- ============================================================================
-- Two features, one table, on purpose. A vehicle check and a "road blocked"
-- report are the same shape — a driver, a moment, a place, some notes and
-- photos — and one well-indexed table is less untested surface than two.
--
-- Both exist as much for the driver as for the office:
--   vehicle_check — photographing damage at shift start is what stops him
--                   being blamed for it at shift end.
--   problem       — reporting a blocked road once, with proof, beats
--                   explaining it three times over the phone.
--
-- SAFE TO RE-RUN.
-- ============================================================================

create table if not exists public.driver_reports (
  id           uuid primary key default gen_random_uuid(),
  driver_id    text not null,
  admin_code   text not null,

  -- vehicle_check | problem
  type         text not null,

  -- Freeform for a problem; for a vehicle check this holds the per-item
  -- verdicts, e.g. {"tyres":"ok","lights":"fault","body":"ok"}. JSONB so the
  -- checklist can grow without another migration.
  details      jsonb not null default '{}'::jsonb,
  note         text,
  photos       text[] not null default array[]::text[],

  -- Where it was raised. A blocked road is meaningless without a location.
  latitude     double precision,
  longitude    double precision,

  -- open | acknowledged | resolved
  status       text not null default 'open',
  -- Set by the driver on a check: does the vehicle have a fault?
  has_fault    boolean not null default false,

  reviewed_by  uuid references auth.users (id) on delete set null,
  reviewed_at  timestamptz,
  review_note  text,

  created_at   timestamptz not null default now(),

  constraint driver_reports_type_valid check (type in ('vehicle_check', 'problem')),
  constraint driver_reports_status_valid check (status in ('open', 'acknowledged', 'resolved'))
);

create index if not exists driver_reports_driver_idx
  on public.driver_reports (driver_id, created_at desc);
create index if not exists driver_reports_admin_idx
  on public.driver_reports (admin_code, created_at desc);
create index if not exists driver_reports_open_idx
  on public.driver_reports (admin_code, status) where status <> 'resolved';

alter table public.driver_reports enable row level security;

drop policy if exists "reports readable" on public.driver_reports;
create policy "reports readable"
  on public.driver_reports for select
  using (true);

-- Constrained to a driver + code pair that genuinely exists, as elsewhere.
drop policy if exists "reports driver insert" on public.driver_reports;
create policy "reports driver insert"
  on public.driver_reports for insert
  with check (
    exists (
      select 1 from public.drivers d
      where d.driver_id = driver_reports.driver_id
        and d.admin_code = driver_reports.admin_code
    )
  );

drop policy if exists "reports owner manage" on public.driver_reports;
create policy "reports owner manage"
  on public.driver_reports for update
  using (
    exists (
      select 1 from public.devices dev
      where dev.connection_code = driver_reports.admin_code
        and dev.user_id = auth.uid()
    )
    or exists (
      select 1 from public.driver_connections dc
      where dc.connection_code = driver_reports.admin_code
        and dc.admin_user_id = auth.uid()
    )
  );

drop policy if exists "reports owner delete" on public.driver_reports;
create policy "reports owner delete"
  on public.driver_reports for delete
  using (
    exists (
      select 1 from public.devices dev
      where dev.connection_code = driver_reports.admin_code
        and dev.user_id = auth.uid()
    )
    or exists (
      select 1 from public.driver_connections dc
      where dc.connection_code = driver_reports.admin_code
        and dc.admin_user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('driver-reports', 'driver-reports', true)
on conflict (id) do nothing;

drop policy if exists "driver reports readable" on storage.objects;
create policy "driver reports readable"
  on storage.objects for select
  using (bucket_id = 'driver-reports');

drop policy if exists "driver reports uploadable" on storage.objects;
create policy "driver reports uploadable"
  on storage.objects for insert
  with check (bucket_id = 'driver-reports');
