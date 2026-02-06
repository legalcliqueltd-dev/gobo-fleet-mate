-- SOS fix (safe with existing FK): support code-based drivers without changing user_id type
-- Approach:
-- - Keep sos_events.user_id as UUID (FK stays intact) for authenticated users
-- - Add sos_events.driver_id (TEXT) for code-based drivers
-- - Allow sos_events.user_id to be NULL for code-based drivers
-- - Update RLS policies to allow anonymous driver inserts when driver_id/admin_code match public.drivers
-- - Update sos_position_updates policies to align

begin;

-- 1) Schema changes
alter table public.sos_events
  add column if not exists driver_id text;

alter table public.sos_events
  alter column user_id drop not null;

-- 2) Replace RLS policies
-- sos_events
drop policy if exists sos_insert_self on public.sos_events;
drop policy if exists sos_select_own_or_admin on public.sos_events;
drop policy if exists sos_insert_self_or_registered_driver on public.sos_events;

create policy sos_select_own_or_admin
on public.sos_events
for select
to public
using (
  (auth.uid() is not null and user_id = auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
);

create policy sos_insert_self_or_registered_driver
on public.sos_events
for insert
to public
with check (
  (
    -- Auth users can create their own SOS
    auth.uid() is not null
    and user_id = auth.uid()
  )
  or
  (
    -- Code-based drivers (anon) can create SOS with user_id NULL + validated driver_id/admin_code
    auth.uid() is null
    and user_id is null
    and driver_id is not null
    and admin_code is not null
    and status = 'open'
    and acknowledged_by is null
    and acknowledged_at is null
    and resolved_by is null
    and resolved_at is null
    and resolved_note is null
    and exists (
      select 1
      from public.drivers d
      where d.driver_id = sos_events.driver_id
        and d.admin_code = sos_events.admin_code
    )
  )
);

-- sos_position_updates
drop policy if exists sos_position_insert_event_owner on public.sos_position_updates;
drop policy if exists sos_position_select_event_owner_or_admin on public.sos_position_updates;

create policy sos_position_select_event_owner_or_admin
on public.sos_position_updates
for select
to public
using (
  exists (
    select 1
    from public.sos_events e
    where e.id = sos_position_updates.sos_event_id
      and (
        (auth.uid() is not null and e.user_id = auth.uid())
        or has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

create policy sos_position_insert_event_owner
on public.sos_position_updates
for insert
to public
with check (
  exists (
    select 1
    from public.sos_events e
    where e.id = sos_position_updates.sos_event_id
      and (
        (auth.uid() is not null and e.user_id = auth.uid())
        or (
          auth.uid() is null
          and e.user_id is null
          and e.driver_id is not null
          and e.admin_code is not null
          and exists (
            select 1
            from public.drivers d
            where d.driver_id = e.driver_id
              and d.admin_code = e.admin_code
          )
        )
        or has_role(auth.uid(), 'admin'::app_role)
      )
  )
);

commit;
