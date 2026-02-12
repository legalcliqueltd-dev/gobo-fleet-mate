
-- 1. Create fleet_stats function for Fleet Analytics page
CREATE OR REPLACE FUNCTION public.fleet_stats(p_since timestamptz)
RETURNS TABLE (
  total_distance_km double precision,
  avg_speed_kmh double precision,
  max_speed_kmh double precision,
  total_idle_minutes integer,
  device_count integer,
  active_count integer,
  idle_count integer,
  offline_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_devices AS (
    SELECT d.id, d.status
    FROM public.devices d
    WHERE d.user_id = auth.uid()
  ),
  device_locations AS (
    SELECT l.device_id, l.latitude, l.longitude, l.speed, l.timestamp
    FROM public.locations l
    WHERE l.device_id IN (SELECT id FROM user_devices)
      AND l.timestamp >= p_since
    ORDER BY l.device_id, l.timestamp ASC
  ),
  pairs AS (
    SELECT
      device_id, latitude, longitude, speed, timestamp,
      lead(latitude) OVER (PARTITION BY device_id ORDER BY timestamp) AS lat2,
      lead(longitude) OVER (PARTITION BY device_id ORDER BY timestamp) AS lon2,
      lead(timestamp) OVER (PARTITION BY device_id ORDER BY timestamp) AS ts2
    FROM device_locations
  ),
  aggregated AS (
    SELECT
      sum(CASE WHEN lat2 IS NOT NULL THEN public.haversine_km(latitude, longitude, lat2, lon2) ELSE 0 END) AS total_distance_km,
      avg(coalesce(speed, 0)) AS avg_speed_kmh,
      max(coalesce(speed, 0)) AS max_speed_kmh,
      sum(CASE WHEN coalesce(speed,0) < 1 AND ts2 IS NOT NULL THEN extract(epoch FROM (ts2 - timestamp))/60.0 ELSE 0 END)::int AS total_idle_minutes
    FROM pairs
  ),
  status_counts AS (
    SELECT
      count(*) AS device_count,
      count(*) FILTER (WHERE status = 'active') AS active_count,
      count(*) FILTER (WHERE status = 'idle') AS idle_count,
      count(*) FILTER (WHERE status = 'offline') AS offline_count
    FROM user_devices
  )
  SELECT
    coalesce(a.total_distance_km, 0),
    coalesce(a.avg_speed_kmh, 0),
    coalesce(a.max_speed_kmh, 0),
    coalesce(a.total_idle_minutes, 0),
    coalesce(s.device_count, 0)::int,
    coalesce(s.active_count, 0)::int,
    coalesce(s.idle_count, 0)::int,
    coalesce(s.offline_count, 0)::int
  FROM aggregated a
  CROSS JOIN status_counts s;
$$;

-- 2. Create fleet_utilization_daily function
CREATE OR REPLACE FUNCTION public.fleet_utilization_daily(p_days int DEFAULT 7)
RETURNS TABLE (
  day date,
  total_active_minutes integer,
  total_device_minutes integer,
  utilization_percent numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_devices AS (
    SELECT id FROM public.devices WHERE user_id = auth.uid()
  ),
  days_series AS (
    SELECT generate_series(
      current_date - (p_days - 1),
      current_date,
      '1 day'::interval
    )::date AS day
  ),
  daily_locations AS (
    SELECT
      l.device_id,
      l.timestamp::date AS day,
      l.speed,
      l.timestamp,
      lead(timestamp) OVER (PARTITION BY l.device_id, l.timestamp::date ORDER BY l.timestamp) AS next_ts
    FROM public.locations l
    WHERE l.device_id IN (SELECT id FROM user_devices)
      AND l.timestamp >= current_date - (p_days - 1)
  ),
  daily_stats AS (
    SELECT
      d.day,
      sum(
        CASE 
          WHEN dl.speed >= 1 AND dl.next_ts IS NOT NULL 
          THEN extract(epoch FROM (dl.next_ts - dl.timestamp))/60.0 
          ELSE 0 
        END
      )::int AS active_minutes
    FROM days_series d
    LEFT JOIN daily_locations dl ON d.day = dl.day
    GROUP BY d.day
  ),
  device_count AS (
    SELECT count(*)::int AS cnt FROM user_devices
  )
  SELECT
    ds.day,
    coalesce(ds.active_minutes, 0)::int AS total_active_minutes,
    (dc.cnt * 1440)::int AS total_device_minutes,
    CASE 
      WHEN dc.cnt > 0 THEN round((coalesce(ds.active_minutes, 0)::numeric / (dc.cnt * 1440) * 100), 2)
      ELSE 0
    END AS utilization_percent
  FROM daily_stats ds
  CROSS JOIN device_count dc
  ORDER BY ds.day;
$$;

-- 3. Make proofs bucket public so admin can view task proof photos
UPDATE storage.buckets SET public = true WHERE id = 'proofs';
