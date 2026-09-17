-- ============================================================================
-- Stations must reach the whole fleet, not one vehicle
-- ============================================================================
-- THE BUG THIS FIXES
--
-- Every vehicle carries its own connection code (devices.connection_code), so
-- a manager with twelve vehicles has twelve codes. A station, however, stores
-- exactly ONE admin_code, and the driver app looks its stations up with
--
--     where admin_code = <the code this driver joined with>
--
-- So a station created while the editor happened to be pointed at code #1 was
-- visible to precisely one driver out of twelve. Everyone else opened the app
-- and saw no stations at all — which is exactly what was reported from the
-- field, and was mistaken for drivers being on an old build.
--
-- THE FIX
--
-- A station belongs to a MANAGER (admin_user_id), not to a connection code.
-- This adds a lookup that resolves a driver's code to the manager who owns it
-- and returns that manager's active stations.
--
-- It is SECURITY DEFINER because the driver app is unauthenticated by design:
-- an anonymous client cannot read `devices` or `driver_connections` to work
-- out who owns its code. The function is deliberately narrow — it takes a code
-- and returns stations, nothing else, and leaks no ownership data.
--
-- SAFE TO RE-RUN.
-- ============================================================================

create or replace function public.stations_for_code(p_code text)
returns setof public.stations
language sql
stable
security definer
set search_path = public
as $$
  select s.*
  from public.stations s
  where s.active
    and s.admin_user_id in (
      select d.user_id
      from public.devices d
      where d.connection_code = p_code
        and d.user_id is not null
      union
      select dc.admin_user_id
      from public.driver_connections dc
      where dc.connection_code = p_code
        and dc.admin_user_id is not null
    );
$$;

-- The driver app calls this anonymously; the manager app may too.
grant execute on function public.stations_for_code(text) to anon, authenticated;

-- Existing rows keep their admin_code (nothing is rewritten), because the
-- function keys on admin_user_id and ignores it. admin_code stays only so
-- older clients that have not been updated keep working exactly as before.

-- ----------------------------------------------------------------------------
-- Check it: should return every active station for the manager who owns the
-- code, whichever of their vehicles that code belongs to.
--
--   select name, admin_code from public.stations_for_code('PUT_A_REAL_CODE');
-- ----------------------------------------------------------------------------
