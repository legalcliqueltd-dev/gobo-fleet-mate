-- Auto status on location insert + offline check
-- Thresholds: active if speed >= 3 km/h, idle if below; offline if no update for 15 minutes.

-- Trigger: mark active/idle on new locations
create or replace function public.ftm_update_status_on_location()
returns trigger
language plpgsql
as $$
declare
  v_speed double precision := coalesce(new.speed, 0);
  v_status text;
begin
  if v_speed >= 3 then
    v_status := 'active';
  else
    v_status := 'idle';
  end if;

  update public.devices
  set status = v_status
  where id = new.device_id;

  return new;
end;
$$;

drop trigger if exists trg_ftm_status_on_location on public.locations;
create trigger trg_ftm_status_on_location
  after insert on public.locations
  for each row execute function public.ftm_update_status_on_location();

-- Function: mark devices offline if last fix older than given minutes (default 15)
create or replace function public.ftm_run_offline_status_check(p_max_minutes int default 15)
returns void
language plpgsql
as $$
begin
  update public.devices d
  set status = 'offline'
  where exists (
    select 1
    from (
      select l.device_id, max(l.timestamp) as last_ts
      from public.locations l
      group by l.device_id
    ) last
    where last.device_id = d.id
      and (now() - last.last_ts) > make_interval(mins => p_max_minutes)
  )
  or not exists (
    select 1 from public.locations l where l.device_id = d.id
  );
end;
$$;

-- Optional scheduler (pg_cron). If extension not enabled, run manually or via Edge Function.
create extension if not exists pg_cron with schema extensions;

-- Run every 5 minutes, set offline if > 15 minutes without updates
select
  cron.schedule(
    'ftm_offline_status',
    '*/5 * * * *',
    $$select public.ftm_run_offline_status_check(15);$$
  )
where not exists (select 1 from cron.job where jobname = 'ftm_offline_status');
