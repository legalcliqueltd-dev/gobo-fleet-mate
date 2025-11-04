-- Geofencing system (Phase 8)
-- This migration has already been applied via the migration tool
-- This file is for reference only

-- Tables:
-- 1. geofences: Store zone definitions (circle or polygon)
-- 2. geofence_events: Track device entry/exit events

-- Features:
-- - Automatic entry/exit detection via SQL trigger on locations table
-- - Point-in-circle and point-in-polygon detection functions
-- - Real-time event notifications via Supabase Realtime
-- - RLS policies ensure users only see their own data

-- Usage:
-- 1. Create geofences via the /geofences UI (circle or polygon)
-- 2. When devices send location updates, the trigger checks all active geofences
-- 3. If state changes (enter/exit), an event is recorded in geofence_events
-- 4. Frontend subscribes to geofence_events for real-time alerts

-- Example: Create a circle geofence manually
-- INSERT INTO public.geofences (user_id, name, type, center_lat, center_lng, radius_meters, geometry, active)
-- VALUES (
--   'YOUR_USER_ID',
--   'Warehouse Zone',
--   'circle',
--   37.7749,
--   -122.4194,
--   1000,
--   '{}',
--   true
-- );

-- Example: Create a polygon geofence manually
-- INSERT INTO public.geofences (user_id, name, type, geometry, active)
-- VALUES (
--   'YOUR_USER_ID',
--   'Downtown Area',
--   'polygon',
--   '[[-122.4194, 37.7749], [-122.4094, 37.7749], [-122.4094, 37.7849], [-122.4194, 37.7849], [-122.4194, 37.7749]]',
--   true
-- );

-- Example: Query events for a specific device
-- SELECT 
--   e.*,
--   g.name as geofence_name,
--   d.name as device_name
-- FROM public.geofence_events e
-- INNER JOIN public.geofences g ON g.id = e.geofence_id
-- INNER JOIN public.devices d ON d.id = e.device_id
-- WHERE e.device_id = 'YOUR_DEVICE_ID'
-- ORDER BY e.timestamp DESC;
