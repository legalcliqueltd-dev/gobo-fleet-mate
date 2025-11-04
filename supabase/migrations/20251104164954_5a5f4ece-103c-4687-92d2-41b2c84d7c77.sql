-- Fix security warnings: set search_path on functions

-- Fix ftm_devices_status_change_trg function
CREATE OR REPLACE FUNCTION public.ftm_devices_status_change_trg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  IF TG_OP = 'INSERT' THEN
    NEW.status_changed_at = now();
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- Fix detect_trips function (if it exists)
CREATE OR REPLACE FUNCTION public.detect_trips()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  last_location RECORD;
  last_speed DOUBLE PRECISION;
  time_since_last DOUBLE PRECISION;
  active_trip RECORD;
  trip_distance DOUBLE PRECISION;
  trip_duration INTEGER;
  trip_avg_speed DOUBLE PRECISION;
  trip_max_speed DOUBLE PRECISION;
BEGIN
  -- Get the last location before this one
  SELECT latitude, longitude, speed, timestamp
  INTO last_location
  FROM public.locations
  WHERE device_id = NEW.device_id
    AND timestamp < NEW.timestamp
  ORDER BY timestamp DESC
  LIMIT 1;
  
  -- If no previous location, can't detect trip
  IF last_location IS NULL THEN
    RETURN NEW;
  END IF;
  
  last_speed := COALESCE(last_location.speed, 0);
  time_since_last := EXTRACT(EPOCH FROM (NEW.timestamp - last_location.timestamp)) / 60.0;
  
  -- Check if there's an active trip
  SELECT * INTO active_trip
  FROM public.trips
  WHERE device_id = NEW.device_id
    AND status = 'in_progress'
  ORDER BY start_time DESC
  LIMIT 1;
  
  -- Trip start detection: was idle (< 5 km/h) and now moving (>= 5 km/h)
  IF last_speed < 5 AND COALESCE(NEW.speed, 0) >= 5 AND active_trip IS NULL THEN
    INSERT INTO public.trips (
      device_id,
      start_time,
      start_latitude,
      start_longitude,
      status
    ) VALUES (
      NEW.device_id,
      NEW.timestamp,
      NEW.latitude,
      NEW.longitude,
      'in_progress'
    );
    
    RETURN NEW;
  END IF;
  
  -- Trip end detection: was moving and now idle for 5+ minutes
  IF active_trip IS NOT NULL AND COALESCE(NEW.speed, 0) < 5 AND time_since_last >= 5 THEN
    -- Calculate trip statistics
    SELECT
      SUM(CASE WHEN lat2 IS NOT NULL THEN public.haversine_km(latitude, longitude, lat2, lon2) ELSE 0 END) as distance,
      EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / 60.0 as duration,
      AVG(COALESCE(speed, 0)) as avg_speed,
      MAX(COALESCE(speed, 0)) as max_speed
    INTO trip_distance, trip_duration, trip_avg_speed, trip_max_speed
    FROM (
      SELECT
        l.latitude,
        l.longitude,
        l.speed,
        l.timestamp,
        LEAD(latitude) OVER (ORDER BY timestamp) as lat2,
        LEAD(longitude) OVER (ORDER BY timestamp) as lon2
      FROM public.locations l
      WHERE l.device_id = NEW.device_id
        AND l.timestamp >= active_trip.start_time
        AND l.timestamp <= NEW.timestamp
      ORDER BY l.timestamp
    ) pairs;
    
    -- Update the trip with end details
    UPDATE public.trips
    SET
      end_time = NEW.timestamp,
      end_latitude = NEW.latitude,
      end_longitude = NEW.longitude,
      distance_km = COALESCE(trip_distance, 0),
      duration_minutes = COALESCE(trip_duration::INTEGER, 0),
      avg_speed_kmh = COALESCE(trip_avg_speed, 0),
      max_speed_kmh = COALESCE(trip_max_speed, 0),
      status = 'completed'
    WHERE id = active_trip.id;
  END IF;
  
  RETURN NEW;
END;
$function$;