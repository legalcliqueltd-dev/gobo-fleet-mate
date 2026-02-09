
-- ============================================
-- DATA CLEANUP
-- ============================================

-- Fix 1: Mark stale active drivers as offline (last seen > 30 minutes ago)
UPDATE public.drivers
SET status = 'offline'
WHERE status = 'active' AND last_seen_at < NOW() - INTERVAL '30 minutes';

-- Fix 2: Expire old temp sessions that weren't cleaned up
UPDATE public.temp_track_sessions
SET status = 'expired'
WHERE expires_at < NOW() AND status NOT IN ('revoked', 'expired');

-- ============================================
-- SECURITY: Fix search_path on all SECURITY DEFINER functions
-- ============================================

CREATE OR REPLACE FUNCTION public.update_driver_last_seen()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE public.drivers
    SET last_seen_at = NEW.updated_at
    WHERE driver_id = NEW.driver_id;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.cleanup_old_driver_locations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    DELETE FROM public.driver_locations
    WHERE updated_at < NOW() - INTERVAL '24 hours';
    UPDATE public.drivers
    SET status = 'inactive'
    WHERE last_seen_at < NOW() - INTERVAL '24 hours'
    AND status = 'active';
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_driver_heartbeat(p_driver_id text, p_status text DEFAULT 'active'::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_result JSON;
    v_updated_count INTEGER;
BEGIN
    UPDATE public.drivers
    SET last_seen_at = CURRENT_TIMESTAMP, status = p_status
    WHERE driver_id = p_driver_id;
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count > 0 THEN
        v_result := json_build_object('success', true, 'driver_id', p_driver_id, 'last_seen_at', CURRENT_TIMESTAMP, 'status', p_status);
    ELSE
        v_result := json_build_object('success', false, 'error', 'Driver not found');
    END IF;
    RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_and_check_code_assignment(p_code text, p_driver_name text)
 RETURNS TABLE(is_valid boolean, admin_user_id uuid, admin_name text, is_code_in_use boolean, existing_driver_name text, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_admin_user_id UUID;
    v_admin_name TEXT;
    v_existing_driver_id TEXT;
    v_existing_driver_name TEXT;
    v_is_code_in_use BOOLEAN := false;
BEGIN
    IF p_driver_name IS NULL OR trim(p_driver_name) = '' THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, false, NULL::TEXT, 'Driver name is required'::TEXT;
        RETURN;
    END IF;
    SELECT dc.admin_user_id, COALESCE(p.full_name, au.email)
    INTO v_admin_user_id, v_admin_name
    FROM public.driver_connections dc
    LEFT JOIN public.profiles p ON dc.admin_user_id = p.id
    LEFT JOIN auth.users au ON dc.admin_user_id = au.id
    WHERE dc.connection_code = p_code AND dc.status = 'active'
    LIMIT 1;
    IF v_admin_user_id IS NULL THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, false, NULL::TEXT, 'Invalid or expired connection code'::TEXT;
        RETURN;
    END IF;
    SELECT d.driver_id, d.driver_name
    INTO v_existing_driver_id, v_existing_driver_name
    FROM public.drivers d
    WHERE d.admin_code = p_code AND d.status = 'active'
    LIMIT 1;
    IF v_existing_driver_id IS NOT NULL THEN
        v_is_code_in_use := true;
    END IF;
    RETURN QUERY SELECT true, v_admin_user_id, v_admin_name, v_is_code_in_use, v_existing_driver_name, NULL::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_driver_with_code(p_driver_id text, p_admin_code text, p_driver_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_existing_driver_id TEXT;
    v_validation_result RECORD;
    v_result JSON;
BEGIN
    IF p_driver_name IS NULL OR trim(p_driver_name) = '' THEN
        RETURN json_build_object('success', false, 'error', 'Driver name is required');
    END IF;
    SELECT * INTO v_validation_result
    FROM public.validate_and_check_code_assignment(p_admin_code, p_driver_name) LIMIT 1;
    IF NOT v_validation_result.is_valid THEN
        RETURN json_build_object('success', false, 'error', v_validation_result.error_message);
    END IF;
    IF v_validation_result.is_code_in_use THEN
        SELECT driver_id INTO v_existing_driver_id
        FROM public.drivers WHERE admin_code = p_admin_code AND driver_id = p_driver_id LIMIT 1;
        IF v_existing_driver_id = p_driver_id THEN
            UPDATE public.drivers SET driver_name = p_driver_name, connected_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP, status = 'active'
            WHERE driver_id = p_driver_id;
            RETURN json_build_object('success', true, 'driver_id', p_driver_id, 'admin_code', p_admin_code, 'driver_name', p_driver_name, 'reconnected', true, 'admin_name', v_validation_result.admin_name);
        ELSE
            RETURN json_build_object('success', false, 'error', 'This code is already assigned to another driver', 'existing_driver_name', v_validation_result.existing_driver_name);
        END IF;
    END IF;
    INSERT INTO public.drivers (driver_id, admin_code, driver_name, connected_at, last_seen_at, status)
    VALUES (p_driver_id, p_admin_code, p_driver_name, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'active')
    ON CONFLICT (driver_id) DO UPDATE SET admin_code = EXCLUDED.admin_code, driver_name = EXCLUDED.driver_name, connected_at = EXCLUDED.connected_at, last_seen_at = EXCLUDED.last_seen_at, status = EXCLUDED.status;
    RETURN json_build_object('success', true, 'driver_id', p_driver_id, 'admin_code', p_admin_code, 'driver_name', p_driver_name, 'reconnected', false, 'admin_name', v_validation_result.admin_name);
END;
$function$;

CREATE OR REPLACE FUNCTION public.auto_update_driver_status()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_updated_active INTEGER;
    v_updated_away INTEGER;
    v_updated_offline INTEGER;
BEGIN
    WITH active_update AS (
        UPDATE public.drivers SET status = 'active'
        WHERE status != 'active' AND last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '2 minutes'
        RETURNING 1
    ) SELECT COUNT(*) INTO v_updated_active FROM active_update;
    WITH away_update AS (
        UPDATE public.drivers SET status = 'away'
        WHERE status != 'away' AND last_seen_at >= CURRENT_TIMESTAMP - INTERVAL '15 minutes' AND last_seen_at < CURRENT_TIMESTAMP - INTERVAL '2 minutes'
        RETURNING 1
    ) SELECT COUNT(*) INTO v_updated_away FROM away_update;
    WITH offline_update AS (
        UPDATE public.drivers SET status = 'offline'
        WHERE status != 'offline' AND last_seen_at < CURRENT_TIMESTAMP - INTERVAL '15 minutes'
        RETURNING 1
    ) SELECT COUNT(*) INTO v_updated_offline FROM offline_update;
    RETURN json_build_object('success', true, 'updated_active', v_updated_active, 'updated_away', v_updated_away, 'updated_offline', v_updated_offline, 'timestamp', CURRENT_TIMESTAMP);
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_emergency_contacts_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.detect_trips()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  SELECT latitude, longitude, speed, timestamp INTO last_location
  FROM public.locations WHERE device_id = NEW.device_id AND timestamp < NEW.timestamp
  ORDER BY timestamp DESC LIMIT 1;
  IF last_location IS NULL THEN RETURN NEW; END IF;
  last_speed := COALESCE(last_location.speed, 0);
  time_since_last := EXTRACT(EPOCH FROM (NEW.timestamp - last_location.timestamp)) / 60.0;
  SELECT * INTO active_trip FROM public.trips
  WHERE device_id = NEW.device_id AND status = 'in_progress'
  ORDER BY start_time DESC LIMIT 1;
  IF last_speed < 5 AND COALESCE(NEW.speed, 0) >= 5 AND active_trip IS NULL THEN
    INSERT INTO public.trips (device_id, start_time, start_latitude, start_longitude, status)
    VALUES (NEW.device_id, NEW.timestamp, NEW.latitude, NEW.longitude, 'in_progress');
    RETURN NEW;
  END IF;
  IF active_trip IS NOT NULL AND COALESCE(NEW.speed, 0) < 5 AND time_since_last >= 5 THEN
    SELECT
      SUM(CASE WHEN lat2 IS NOT NULL THEN public.haversine_km(latitude, longitude, lat2, lon2) ELSE 0 END),
      EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / 60.0,
      AVG(COALESCE(speed, 0)),
      MAX(COALESCE(speed, 0))
    INTO trip_distance, trip_duration, trip_avg_speed, trip_max_speed
    FROM (
      SELECT l.latitude, l.longitude, l.speed, l.timestamp,
        LEAD(latitude) OVER (ORDER BY timestamp) as lat2,
        LEAD(longitude) OVER (ORDER BY timestamp) as lon2
      FROM public.locations l
      WHERE l.device_id = NEW.device_id AND l.timestamp >= active_trip.start_time AND l.timestamp <= NEW.timestamp
      ORDER BY l.timestamp
    ) pairs;
    UPDATE public.trips SET
      end_time = NEW.timestamp, end_latitude = NEW.latitude, end_longitude = NEW.longitude,
      distance_km = COALESCE(trip_distance, 0), duration_minutes = COALESCE(trip_duration::INTEGER, 0),
      avg_speed_kmh = COALESCE(trip_avg_speed, 0), max_speed_kmh = COALESCE(trip_max_speed, 0), status = 'completed'
    WHERE id = active_trip.id;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_task_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.ftm_devices_status_change_trg()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- Ensure the detect_trips trigger is attached
DROP TRIGGER IF EXISTS trg_detect_trips ON public.locations;
CREATE TRIGGER trg_detect_trips
  AFTER INSERT ON public.locations
  FOR EACH ROW EXECUTE FUNCTION public.detect_trips();
