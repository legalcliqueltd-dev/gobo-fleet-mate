-- Haversine distance and device_stats RPC (respects RLS; no SECURITY DEFINER)
create or replace function public.haversine_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision
language sql
stable
as $$
  select 2 * 6371.0 * asin(sqrt(
    pow(sin(radians((lat2 - lat1)/2)), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * pow(sin(radians((lon2 - lon1)/2)), 2)
  ));
$$;

-- Stats since p_since: total distance, avg/max speed, idle minutes (speed < 1 km/h)
create or replace function public.device_stats(p_device_id uuid, p_since timestamptz)
returns table (
  distance_km double precision,
  avg_speed_kmh double precision,
  max_speed_kmh double precision,
  idle_minutes integer
)
language sql
as $$
  with pts as (
    select id, latitude, longitude, speed, timestamp
    from public.locations
    where device_id = p_device_id
      and timestamp >= p_since
    order by timestamp asc
  ), pairs as (
    select
      p1.*,
      lead(latitude) over (order by timestamp) as lat2,
      lead(longitude) over (order by timestamp) as lon2,
      lead(timestamp) over (order by timestamp) as ts2
    from pts p1
  ), agg as (
    select
      sum(case when lat2 is not null then public.haversine_km(latitude, longitude, lat2, lon2) else 0 end) as distance_km,
      avg(coalesce(speed, 0)) as avg_speed_kmh,
      max(coalesce(speed, 0)) as max_speed_kmh,
      sum(case when coalesce(speed,0) < 1 and ts2 is not null then extract(epoch from (ts2 - timestamp))/60.0 else 0 end)::int as idle_minutes
    from pairs
  )
  select
    coalesce(distance_km, 0),
    coalesce(avg_speed_kmh, 0),
    coalesce(max_speed_kmh, 0),
    coalesce(idle_minutes, 0)
  from agg;
$$;
