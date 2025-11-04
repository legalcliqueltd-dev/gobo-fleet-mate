-- Trip Detection System
-- This SQL file documents the trips table and automatic trip detection

-- =============================================
-- TRIPS TABLE
-- =============================================
-- The trips table is already created via migration
-- It stores automatically detected trips with start/end locations, duration, and speed metrics

-- =============================================
-- AUTOMATIC TRIP DETECTION
-- =============================================
-- The detect_trips() function and trigger automatically:
-- 1. Detect trip START: when device goes from idle (<5 km/h) to moving (≥5 km/h)
-- 2. Detect trip END: when device has been idle for 5+ minutes after moving
-- 3. Calculate trip metrics: distance, duration, average speed, max speed

-- =============================================
-- TRIP DETECTION LOGIC
-- =============================================
-- Trip Start Conditions:
--   - Previous speed < 5 km/h (idle)
--   - Current speed ≥ 5 km/h (moving)
--   - No active trip exists for the device
--
-- Trip End Conditions:
--   - Active trip exists
--   - Current speed < 5 km/h (idle)
--   - Time since last location ≥ 5 minutes

-- =============================================
-- HAVERSINE DISTANCE CALCULATION
-- =============================================
-- The system uses the haversine_km() function to calculate distances between GPS coordinates
-- This gives accurate distance measurements in kilometers

-- =============================================
-- TRIP METRICS
-- =============================================
-- For each completed trip, the system calculates:
--   - distance_km: Total distance traveled
--   - duration_minutes: Time from start to end
--   - avg_speed_kmh: Average speed during the trip
--   - max_speed_kmh: Maximum speed recorded

-- =============================================
-- USAGE
-- =============================================
-- Trips are detected automatically as location data comes in
-- No manual intervention required
-- Access trip data via the trips table or the /trips page in the app

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
-- RLS policies ensure users can only see trips for their own devices
-- Policies are already set up via migration
