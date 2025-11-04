-- Fleet-wide analytics RPC functions (respects RLS)

-- Get aggregated fleet stats for a time range
create or replace function public.fleet_stats(p_since timestamptz)
returns table (
  total_distance_km double precision,
  avg_speed_kmh double precision,
  max_speed_kmh double precision,
  total_idle_minutes integer,
  device_count integer,
  active_count integer,
  idle_count integer,
  offline_count integer
)
language sql
as $$
  with user_devices as (
    select d.id, d.status
    from public.devices d
    where d.user_id = auth.uid()
  ),
  device_locations as (
    select l.device_id, l.latitude, l.longitude, l.speed, l.timestamp
    from public.locations l
    where l.device_id in (select id from user_devices)
      and l.timestamp >= p_since
    order by l.device_id, l.timestamp asc
  ),
  pairs as (
    select
      device_id,
      latitude,
      longitude,
      speed,
      timestamp,
      lead(latitude) over (partition by device_id order by timestamp) as lat2,
      lead(longitude) over (partition by device_id order by timestamp) as lon2,
      lead(timestamp) over (partition by device_id order by timestamp) as ts2
    from device_locations
  ),
  aggregated as (
    select
      sum(case when lat2 is not null then public.haversine_km(latitude, longitude, lat2, lon2) else 0 end) as total_distance_km,
      avg(coalesce(speed, 0)) as avg_speed_kmh,
      max(coalesce(speed, 0)) as max_speed_kmh,
      sum(case when coalesce(speed,0) < 1 and ts2 is not null then extract(epoch from (ts2 - timestamp))/60.0 else 0 end)::int as total_idle_minutes
    from pairs
  ),
  status_counts as (
    select
      count(*) as device_count,
      count(*) filter (where status = 'active') as active_count,
      count(*) filter (where status = 'idle') as idle_count,
      count(*) filter (where status = 'offline') as offline_count
    from user_devices
  )
  select
    coalesce(a.total_distance_km, 0),
    coalesce(a.avg_speed_kmh, 0),
    coalesce(a.max_speed_kmh, 0),
    coalesce(a.total_idle_minutes, 0),
    coalesce(s.device_count, 0)::int,
    coalesce(s.active_count, 0)::int,
    coalesce(s.idle_count, 0)::int,
    coalesce(s.offline_count, 0)::int
  from aggregated a
  cross join status_counts s;
$$;

-- Get daily fleet utilization (active time vs total time)
create or replace function public.fleet_utilization_daily(p_days int default 7)
returns table (
  day date,
  total_active_minutes integer,
  total_device_minutes integer,
  utilization_percent numeric
)
language sql
as $$
  with user_devices as (
    select id from public.devices where user_id = auth.uid()
  ),
  days_series as (
    select generate_series(
      current_date - (p_days - 1),
      current_date,
      '1 day'::interval
    )::date as day
  ),
  daily_locations as (
    select
      l.device_id,
      l.timestamp::date as day,
      l.speed,
      l.timestamp,
      lead(timestamp) over (partition by l.device_id, l.timestamp::date order by l.timestamp) as next_ts
    from public.locations l
    where l.device_id in (select id from user_devices)
      and l.timestamp >= current_date - (p_days - 1)
  ),
  daily_stats as (
    select
      d.day,
      sum(
        case 
          when dl.speed >= 1 and dl.next_ts is not null 
          then extract(epoch from (dl.next_ts - dl.timestamp))/60.0 
          else 0 
        end
      )::int as active_minutes
    from days_series d
    left join daily_locations dl on d.day = dl.day
    group by d.day
  ),
  device_count as (
    select count(*)::int as cnt from user_devices
  )
  select
    ds.day,
    coalesce(ds.active_minutes, 0)::int as total_active_minutes,
    (dc.cnt * 1440)::int as total_device_minutes,
    case 
      when dc.cnt > 0 then round((coalesce(ds.active_minutes, 0)::numeric / (dc.cnt * 1440) * 100), 2)
      else 0
    end as utilization_percent
  from daily_stats ds
  cross join device_count dc
  order by ds.day;
$$;
