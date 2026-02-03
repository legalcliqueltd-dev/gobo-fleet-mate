-- Create driver stats function for analytics
CREATE OR REPLACE FUNCTION public.driver_stats(
  p_driver_id text,
  p_since timestamptz
)
RETURNS TABLE (
  distance_km double precision,
  avg_speed_kmh double precision,
  max_speed_kmh double precision,
  idle_minutes double precision,
  active_minutes double precision,
  total_points bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH points AS (
    SELECT 
      latitude, 
      longitude, 
      speed, 
      recorded_at,
      LAG(latitude) OVER (ORDER BY recorded_at) as prev_lat,
      LAG(longitude) OVER (ORDER BY recorded_at) as prev_lng,
      LAG(recorded_at) OVER (ORDER BY recorded_at) as prev_time
    FROM driver_location_history
    WHERE driver_id = p_driver_id
      AND recorded_at >= p_since
    ORDER BY recorded_at
  ),
  distances AS (
    SELECT
      speed,
      recorded_at,
      prev_time,
      CASE 
        WHEN prev_lat IS NOT NULL AND prev_lng IS NOT NULL 
        THEN haversine_km(prev_lat, prev_lng, latitude, longitude)
        ELSE 0 
      END as segment_distance,
      CASE 
        WHEN prev_time IS NOT NULL 
        THEN EXTRACT(EPOCH FROM (recorded_at - prev_time)) / 60.0
        ELSE 0 
      END as segment_minutes
    FROM points
  )
  SELECT 
    COALESCE(SUM(segment_distance), 0)::double precision as distance_km,
    COALESCE(AVG(NULLIF(speed, 0)), 0)::double precision as avg_speed_kmh,
    COALESCE(MAX(speed), 0)::double precision as max_speed_kmh,
    COALESCE(SUM(CASE WHEN COALESCE(speed, 0) < 5 THEN segment_minutes ELSE 0 END), 0)::double precision as idle_minutes,
    COALESCE(SUM(CASE WHEN COALESCE(speed, 0) >= 5 THEN segment_minutes ELSE 0 END), 0)::double precision as active_minutes,
    COUNT(*)::bigint as total_points
  FROM distances;
END;
$$;

-- Create index for efficient driver location history queries
CREATE INDEX IF NOT EXISTS idx_driver_location_history_driver_time 
ON driver_location_history (driver_id, recorded_at DESC);