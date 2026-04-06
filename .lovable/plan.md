

# Plan: Persistent Android Background Tracking + Location-Off Admin Alert

## Problem
1. On Android, location tracking dies when the app is backgrounded or screen locks — the WebView gets suspended
2. No mechanism exists to alert the admin when a driver intentionally disables their location

## Solution

### Part 1: Android Foreground Service (keeps tracking alive)

**Install** `@capawesome-team/capacitor-android-foreground-service` plugin.

**New file**: `src/utils/androidForegroundService.ts`
- Wrapper to start/stop a persistent Android foreground service
- Shows a notification: "FleetTrackMate — Location tracking active"
- Only activates on native Android platform

**Update**: `src/hooks/useBackgroundLocationTracking.ts`
- Before starting `watchPosition` on Android, start the foreground service
- When tracking stops, stop the foreground service
- This keeps the app process alive so `watchPosition` continues firing in background

**Update**: `android/app/src/main/AndroidManifest.xml` (via post-sync script)
- Add permissions: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_LOCATION`, `ACCESS_BACKGROUND_LOCATION`, `WAKE_LOCK`

**Update**: `capacitor.config.ts`
- Add `@capawesome-team/capacitor-android-foreground-service` to `includePlugins`

**Update**: `scripts/android-post-sync.ps1` and `.sh`
- Ensure the foreground service plugin is not stripped during cleanup

**What this achieves**: App stays alive when minimized, screen locked, or switching apps. Covers 95% of real-world background usage. Does NOT survive force-kill (that would require a headless native service — significantly more complex).

### Part 2: Admin Alert When Driver Disables Location

**Update**: `src/hooks/useBackgroundLocationTracking.ts`
- Add a `permissions.onChange` / periodic permission check
- When location permission changes from granted to denied, or GPS is turned off:
  - Call the `connect-driver` edge function with a new action: `location-disabled`

**Update**: `supabase/functions/connect-driver/index.ts`
- Add handler for `action: 'location-disabled'`
- Inserts a record into a new `driver_alerts` table (or reuses `sos_events` with a special hazard type)
- Sends an email to the admin via the existing `send-email` function

**New migration**: Create `driver_alerts` table
- Columns: `id`, `driver_id`, `admin_code`, `alert_type` (e.g. `location_disabled`), `message`, `created_at`, `acknowledged_at`
- RLS: admins can read, anonymous drivers can insert via edge function

**Update**: Admin dashboard notification
- Show a warning badge/toast when a driver disables location
- Display in the existing notification bell or as a new alert type

### Files to change
- `src/utils/androidForegroundService.ts` — new file, foreground service manager
- `src/hooks/useBackgroundLocationTracking.ts` — start foreground service on Android + detect location-off
- `capacitor.config.ts` — add foreground service plugin
- `scripts/android-post-sync.ps1` / `.sh` — preserve foreground service plugin + permissions
- `supabase/functions/connect-driver/index.ts` — add `location-disabled` action
- New migration for `driver_alerts` table
- Admin dashboard — display location-disabled alerts

### Post-implementation steps
1. `npm install @capawesome-team/capacitor-android-foreground-service`
2. `npm run build && npx cap sync android`
3. Run `android-post-sync.ps1`
4. Test: minimize app, lock screen — verify locations still arrive on admin dashboard
5. Test: disable location on phone — verify admin receives alert

