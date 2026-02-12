
-- Create driver-based fleet stats function that works with the driver tracking system
CREATE OR REPLACE FUNCTION public.driver_fleet_stats(p_admin_codes text[], p_since timestamptz)
RETURNS TABLE (
  total_distance_km double precision,
  avg_speed_kmh double precision,
  max_speed_kmh double precision,
  total_idle_minutes integer,
  driver_count integer,
  active_count integer,
  idle_count integer,
  offline_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH admin_drivers AS (
    SELECT d.driver_id, d.status, d.last_seen_at
    FROM public.drivers d
    WHERE d.admin_code = ANY(p_admin_codes)
  ),
  history_points AS (
    SELECT 
      h.driver_id, h.latitude, h.longitude, h.speed, h.recorded_at,
      LAG(h.latitude) OVER (PARTITION BY h.driver_id ORDER BY h.recorded_at) as prev_lat,
      LAG(h.longitude) OVER (PARTITION BY h.driver_id ORDER BY h.recorded_at) as prev_lng,
      LAG(h.recorded_at) OVER (PARTITION BY h.driver_id ORDER BY h.recorded_at) as prev_time
    FROM public.driver_location_history h
    WHERE h.admin_code = ANY(p_admin_codes)
      AND h.recorded_at >= p_since
  ),
  distances AS (
    SELECT
      speed,
      CASE 
        WHEN prev_lat IS NOT NULL AND prev_lng IS NOT NULL 
        THEN public.haversine_km(prev_lat, prev_lng, latitude, longitude)
        ELSE 0 
      END as segment_distance,
      CASE 
        WHEN prev_time IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (recorded_at - prev_time)) / 60.0
        ELSE 0 
      END as segment_minutes
    FROM history_points
  ),
  aggregated AS (
    SELECT
      COALESCE(SUM(segment_distance), 0) as total_dist,
      COALESCE(AVG(NULLIF(speed, 0)), 0) as avg_spd,
      COALESCE(MAX(speed), 0) as max_spd,
      COALESCE(SUM(CASE WHEN COALESCE(speed, 0) < 5 THEN segment_minutes ELSE 0 END), 0)::int as idle_min
    FROM distances
  ),
  status_counts AS (
    SELECT
      COUNT(*)::int as driver_count,
      COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '2 minutes')::int as active_count,
      COUNT(*) FILTER (WHERE last_seen_at >= NOW() - INTERVAL '15 minutes' AND last_seen_at < NOW() - INTERVAL '2 minutes')::int as idle_count,
      COUNT(*) FILTER (WHERE last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '15 minutes')::int as offline_count
    FROM admin_drivers
  )
  SELECT
    a.total_dist,
    a.avg_spd,
    a.max_spd,
    a.idle_min,
    s.driver_count,
    s.active_count,
    s.idle_count,
    s.offline_count
  FROM aggregated a
  CROSS JOIN status_counts s;
END;
$$;

-- Create driver-based daily utilization function
CREATE OR REPLACE FUNCTION public.driver_fleet_utilization_daily(p_admin_codes text[], p_days int DEFAULT 7)
RETURNS TABLE (
  day date,
  total_active_minutes integer,
  total_driver_minutes integer,
  utilization_percent numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH admin_drivers AS (
    SELECT driver_id FROM public.drivers WHERE admin_code = ANY(p_admin_codes)
  ),
  days_series AS (
    SELECT generate_series(
      current_date - (p_days - 1),
      current_date,
      '1 day'::interval
    )::date AS d
  ),
  daily_locations AS (
    SELECT
      h.driver_id,
      h.recorded_at::date AS d,
      h.speed,
      h.recorded_at,
      LEAD(h.recorded_at) OVER (PARTITION BY h.driver_id, h.recorded_at::date ORDER BY h.recorded_at) AS next_ts
    FROM public.driver_location_history h
    WHERE h.driver_id IN (SELECT driver_id FROM admin_drivers)
      AND h.recorded_at >= current_date - (p_days - 1)
  ),
  daily_stats AS (
    SELECT
      ds.d,
      SUM(
        CASE 
          WHEN dl.speed >= 5 AND dl.next_ts IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (dl.next_ts - dl.recorded_at))/60.0 
          ELSE 0 
        END
      )::int AS active_minutes
    FROM days_series ds
    LEFT JOIN daily_locations dl ON ds.d = dl.d
    GROUP BY ds.d
  ),
  driver_count AS (
    SELECT COUNT(*)::int AS cnt FROM admin_drivers
  )
  SELECT
    dst.d,
    COALESCE(dst.active_minutes, 0)::int,
    (dc.cnt * 1440)::int,
    CASE 
      WHEN dc.cnt > 0 THEN ROUND((COALESCE(dst.active_minutes, 0)::numeric / NULLIF(dc.cnt * 1440, 0) * 100), 2)
      ELSE 0
    END
  FROM daily_stats dst
  CROSS JOIN driver_count dc
  ORDER BY dst.d;
END;
$$;
