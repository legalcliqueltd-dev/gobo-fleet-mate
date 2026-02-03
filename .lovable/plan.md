

# Comprehensive Driver App and Admin Dashboard Enhancement Plan

## Overview

This plan addresses enhancements for both the driver mobile app and the admin web dashboard, focusing on improved location tracking, SOS functionality, navigation restructuring, and UI/UX improvements.

---

## Part 1: Driver App Enhancements

### 1.1 Always-On Duty by Default

**Current State**: Driver starts with `onDuty = false` and must manually toggle it on.

**Changes**:
- Initialize `onDuty` state to `true` by default
- Persist duty status to `localStorage` so it survives app restarts
- Only allow turning OFF duty from Settings page with a confirmation dialog
- Remove the prominent On/Off Duty toggle from the dashboard map screen
- Add a small status indicator showing "Tracking Active" instead of a toggle

**Files to Modify**:
- `src/pages/app/DriverAppDashboard.tsx`
- `src/pages/app/DriverAppSettings.tsx`

---

### 1.2 Mandatory Location Permission Prompt

**Current State**: App requests location permission but doesn't block access if denied.

**Changes**:
- Create a new full-screen `LocationBlocker` component
- Check location permission on dashboard load
- If permission is denied or not granted, show a blocking overlay:
  - Explanation of why location is needed
  - Button to open device settings
  - "Retry" button to re-check permission
- Driver cannot use dashboard, tasks, or SOS until location is enabled

**New Component**:
- `src/components/driver/LocationBlocker.tsx`

**Files to Modify**:
- `src/pages/app/DriverAppDashboard.tsx`
- `src/components/layout/DriverAppLayout.tsx`

---

### 1.3 Driver Trail on Map with Current Location

**Current State**: Map shows driver's current position but no trail/history.

**Changes**:
- Track location history locally during the session
- Store trail in `localStorage` (last 24 hours max)
- Draw a polyline on the map showing the driver's movement trail
- Different colored markers for start point and current position
- Trail fades in opacity based on age of points

**Technical Approach**:
- Accumulate location updates in state array
- Use Google Maps Polyline component
- Color gradient: newer points = brighter blue, older = faded

**Files to Modify**:
- `src/pages/app/DriverAppDashboard.tsx`

---

### 1.4 Accurate Location Sync to Admin

**Current State**: Location is sent via `useBackgroundLocationTracking` hook.

**Improvements**:
- Add location accuracy filter (only send if accuracy is less than 100 meters)
- Implement retry logic for failed location updates
- Add queue system for offline locations (send when back online)
- Show sync status indicator on dashboard
- Display last sync timestamp prominently
- Send driver status heartbeat every 30 seconds

**Files to Modify**:
- `src/hooks/useBackgroundLocationTracking.ts`
- `src/pages/app/DriverAppDashboard.tsx`
- `src/components/driver/DriverStatusCard.tsx`

---

### 1.5 UI/UX Improvements for Driver App

**Changes**:
- Larger, clearer map (use full available height)
- Floating status card at bottom with:
  - Current speed (large font)
  - GPS accuracy indicator
  - Last sync time
  - Battery level
- Remove on-duty toggle from main screen
- Add smooth animations for location updates
- Improve task markers with distance indicators

**Files to Modify**:
- `src/pages/app/DriverAppDashboard.tsx`
- `src/components/driver/DriverStatusCard.tsx`
- `src/components/layout/DriverAppLayout.tsx`

---

## Part 2: Admin Dashboard Enhancements

### 2.1 SOS Button for Admin - Receive Only

**Current State**: Admin has an SOS button that links to `/driver` page (which is for drivers to send SOS).

**Changes**:
- Remove the SOS button from admin header that links to `/driver`
- Keep the SOS Notification Bell (already correct for receiving)
- Ensure SOSNotificationBell shows count of open incidents
- When clicked, navigate to `/ops/incidents`
- Add audio alert for new SOS events
- Show toast notifications for new emergencies

**Files to Modify**:
- `src/components/layout/AppLayout.tsx`
- `src/components/sos/SOSNotificationBell.tsx`

---

### 2.2 Driver Trail on Driver Details Page with Time Filter

**Current State**: Driver Details page shows location history but filter options are limited.

**Changes**:
- Add time range selector: 1 hour, 4 hours, 12 hours, 24 hours, 3 days, 7 days
- Load location history based on selected range
- Optimize map to clearly show the trail path
- Add playback controls (optional): step through timeline
- Show speed at each point on hover
- Display total distance traveled in selected period
- Add heat intensity for frequently visited areas

**New UI Elements**:
- Time range dropdown/buttons
- Distance summary card
- Enhanced map legend

**Files to Modify**:
- `src/pages/DriverDetails.tsx`
- `src/components/map/DriverLocationMap.tsx`

---

### 2.3 Double-Click Driver Name to Navigate to Details

**Current State**: Single click focuses on map, external link icon goes to details.

**Changes**:
- Add double-click handler on driver name in "Your Devices" list
- Double-click navigates to `/driver/{driver_id}` (full details page)
- Keep single-click for map focus
- Add visual hint (underline on hover) to indicate interactivity

**Files to Modify**:
- `src/components/DriversList.tsx`

---

### 2.4 Real-time Insights on Driver Details Page

**Current State**: Insights are based on device_id and use `device_stats` RPC function.

**Changes**:
- Create or adapt `driver_stats` RPC function for driver-based analytics
- Show real-time data on Driver Details page:
  - Current speed
  - Today's total distance
  - Active time vs idle time
  - Average speed
  - Max speed reached
- Auto-refresh every 30 seconds
- Visual gauges/charts for key metrics

**New SQL Function**:
```sql
CREATE FUNCTION driver_stats(p_driver_id uuid, p_since timestamptz)
RETURNS TABLE (
  distance_km numeric,
  avg_speed_kmh numeric,
  max_speed_kmh numeric,
  idle_minutes numeric,
  active_minutes numeric
)
```

**New Hook**:
- `src/hooks/useDriverInsights.ts`

**Files to Modify**:
- `src/pages/DriverDetails.tsx`

---

### 2.5 Navigation Restructure

**Current State**: Admin nav has: Home, Analytics, Trips, Geofences, Settings

**Changes**:
- Remove from main navigation: Analytics, Trips, Geofences
- Keep in main navigation: Home, Settings
- Merge Home and Settings into a single horizontal tab bar (since only 2 items)
- Move Analytics, Trips, Geofences to Driver Details page as tabs/sections:
  - When viewing a specific driver, show these as sub-tabs
  - Make them driver-specific (filter by driver_id)

**New Navigation Structure**:

```text
Main Nav:
  - Home (Dashboard with map and drivers list)
  - Settings

Driver Details Page Tabs:
  - Overview (current location, status)
  - Trail/History (location history with time filters)
  - Analytics (speed, distance, idle time)
  - Trips (driver's trips)
  - Geofences (geofence events for this driver)
```

**Files to Modify**:
- `src/components/layout/AppLayout.tsx`
- `src/pages/DriverDetails.tsx`
- `src/pages/Trips.tsx` (make filterable by driver)
- `src/pages/Geofences.tsx` (make filterable by driver)

---

## Part 3: Database and Backend Changes

### 3.1 New SQL Function for Driver Stats

```sql
CREATE OR REPLACE FUNCTION public.driver_stats(
  p_driver_id uuid,
  p_since timestamptz
)
RETURNS TABLE (
  distance_km double precision,
  avg_speed_kmh double precision,
  max_speed_kmh double precision,
  idle_minutes double precision,
  active_minutes double precision
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(distance_between_points), 0) as distance_km,
    COALESCE(AVG(speed), 0) as avg_speed_kmh,
    COALESCE(MAX(speed), 0) as max_speed_kmh,
    -- Calculate idle time (speed < 5 km/h)
    COALESCE(COUNT(*) FILTER (WHERE speed < 5) * 0.5, 0) as idle_minutes,
    COALESCE(COUNT(*) FILTER (WHERE speed >= 5) * 0.5, 0) as active_minutes
  FROM driver_location_history
  WHERE driver_id = p_driver_id
    AND recorded_at >= p_since;
END;
$$;
```

### 3.2 Extended Location History Retention

- Ensure `driver_location_history` table retains data for at least 7 days
- Add index on `(driver_id, recorded_at)` for efficient range queries

---

## Part 4: Implementation Order

| Phase | Tasks | Priority |
|-------|-------|----------|
| 1 | Location blocker for driver app | High |
| 2 | Always-on duty + persistence | High |
| 3 | Driver trail on driver dashboard | High |
| 4 | Accurate location sync improvements | High |
| 5 | Admin SOS button fix (receive only) | High |
| 6 | Double-click navigation to driver details | Medium |
| 7 | Time filter for driver trail (admin) | Medium |
| 8 | Navigation restructure | Medium |
| 9 | Real-time driver insights | Medium |
| 10 | Move Analytics/Trips/Geofences to driver pages | Low |

---

## Technical Summary

### Files to Create:
1. `src/components/driver/LocationBlocker.tsx` - Full-screen location permission blocker
2. `src/hooks/useDriverInsights.ts` - Driver-specific analytics hook
3. SQL migration for `driver_stats` function

### Files to Modify:
1. `src/pages/app/DriverAppDashboard.tsx` - Trail, duty persistence, location blocker
2. `src/pages/app/DriverAppSettings.tsx` - Duty toggle moved here
3. `src/components/layout/DriverAppLayout.tsx` - UI adjustments
4. `src/components/layout/AppLayout.tsx` - Remove SOS button, simplify nav
5. `src/components/sos/SOSNotificationBell.tsx` - Enhance for admin use
6. `src/components/DriversList.tsx` - Double-click navigation
7. `src/pages/DriverDetails.tsx` - Add tabs, time filters, insights
8. `src/components/map/DriverLocationMap.tsx` - Enhanced trail visualization
9. `src/hooks/useBackgroundLocationTracking.ts` - Accuracy filter, retry logic
10. `src/components/driver/DriverStatusCard.tsx` - Enhanced sync status display

### Estimated Complexity:
- High complexity changes: Location blocker, navigation restructure, driver insights
- Medium complexity: Trail visualization, duty persistence, time filters
- Low complexity: Double-click navigation, SOS button removal

