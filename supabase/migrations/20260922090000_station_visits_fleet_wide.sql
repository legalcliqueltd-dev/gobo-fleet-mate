-- ============================================================================
-- A driver must be able to RECORD a visit, not just see the station
-- ============================================================================
-- THE BUG THIS FIXES
--
-- 20260917090000 made stations READABLE fleet-wide: a station belongs to a
-- manager, so stations_for_code() resolves a driver's connection code to that
-- manager and returns all of their stations. That half shipped and works.
--
-- The WRITE path was never fixed. The insert policy on station_visits still
-- says:
--
--     and s.admin_code = station_visits.admin_code
--
-- The visit carries the DRIVER's connection code. The station stores the ONE
-- code the editor happened to be pointed at when it was created. In a fleet
-- with twelve vehicles those are the same string for exactly one driver.
--
-- So every other driver could see the station, walk into it, and watch the
-- dwell counter run — and then Postgres rejected the arrival. recordArrival()
-- threw, useStationWatcher put the station back in the retry set, and the
-- receipt never unlocked. The counter kept counting because that is client-
-- side arithmetic; only the server write failed.
--
-- This is why it worked on the owner's own phone (their code IS the station's
-- code) and failed for every tester.
--
-- THE FIX
--
-- Key the check on the MANAGER, exactly as the read path now does: resolve the
-- code on the visit to the manager who issued it, and require the station to
-- belong to that manager.
--
-- This is also STRICTER than what it replaces. The old rule accepted any
-- admin_code string that matched a station's stored code. The new one requires
-- the code to be a genuinely issued connection code belonging to that
-- station's owner, so a fabricated or copied code resolves to NULL and is
-- rejected.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- Resolve a driver connection code to the manager who issued it.
-- SECURITY DEFINER because drivers are unauthenticated by design and cannot
-- read `devices` or `driver_connections` themselves. Deliberately narrow: it
-- takes a code and returns one uuid, and leaks nothing else.
create or replace function public.manager_for_code(p_code text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select d.user_id
      from public.devices d
      where d.connection_code = p_code
        and d.user_id is not null
      limit 1
    ),
    (
      select dc.admin_user_id
      from public.driver_connections dc
      where dc.connection_code = p_code
        and dc.admin_user_id is not null
      limit 1
    )
  );
$$;

grant execute on function public.manager_for_code(text) to anon, authenticated;

-- --- station_visits: arrival ------------------------------------------------
drop policy if exists "visits driver insert" on public.station_visits;
create policy "visits driver insert"
  on public.station_visits for insert
  with check (
    exists (
      select 1 from public.stations s
      where s.id = station_visits.station_id
        and s.active
        and s.admin_user_id = public.manager_for_code(station_visits.admin_code)
    )
  );

-- --- station_visits: attaching the photo receipt ----------------------------
drop policy if exists "visits driver update" on public.station_visits;
create policy "visits driver update"
  on public.station_visits for update
  using (
    exists (
      select 1 from public.stations s
      where s.id = station_visits.station_id
        and s.admin_user_id = public.manager_for_code(station_visits.admin_code)
    )
  )
  with check (
    exists (
      select 1 from public.stations s
      where s.id = station_visits.station_id
        and s.admin_user_id = public.manager_for_code(station_visits.admin_code)
    )
  );

-- ----------------------------------------------------------------------------
-- Check it. Both should return the same manager uuid for any two codes
-- belonging to the same fleet, and NULL for a code that was never issued:
--
--   select public.manager_for_code('CODE_FROM_VEHICLE_1');
--   select public.manager_for_code('CODE_FROM_VEHICLE_2');
--   select public.manager_for_code('NOTAREALCODE');
--
-- Then confirm a second vehicle's driver can now record an arrival:
--
--   select s.name, public.manager_for_code('CODE_FROM_VEHICLE_2') = s.admin_user_id as allowed
--   from public.stations s where s.active;
-- ----------------------------------------------------------------------------
