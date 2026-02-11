

## Fix Tasks Not Showing + Always-On Background Tracking

### Problem 1: Tasks Not Showing for Pat

**Root Cause:** Column mismatch in two files.

- `DriverAppTasks.tsx` (line 47) queries `.eq('assigned_driver_id', session.driverId)` -- this is CORRECT
- `DriverAppDashboard.tsx` (line 185) queries `.eq('assigned_user_id', session.driverId)` -- this is WRONG

The `assigned_user_id` column holds the Supabase auth UUID, but `session.driverId` from the driver app is the text-based `driver_id` from the `drivers` table. Pat's task "Dr. Ian" is assigned via `assigned_driver_id = '661b4ce7-aa59-4479-9854-d72490ef3bfc'`, so the Dashboard query returns nothing because it's looking at the wrong column.

**Fix:** Change `DriverAppDashboard.tsx` line 185 from `assigned_user_id` to `assigned_driver_id`.

---

### Problem 2: Location Turns Off When App Is Backgrounded/Closed

**Root Cause:** The driver dashboard only uses `useBackgroundLocationTracking`, which relies on `navigator.geolocation.watchPosition` (browser API). This API stops working when:
- The app goes to the background
- The user switches to another app  
- The phone screen locks
- The app is closed/killed

The `useIOSBackgroundTracking` hook exists with the transistorsoft background geolocation plugin (which survives all of the above), but it is **never imported or used anywhere in the app**.

**Fix:** Integrate `useIOSBackgroundTracking` into the Driver Dashboard so it activates on native iOS, while the existing browser-based tracking remains as fallback for web.

---

### Plan

#### Step 1: Fix Task Column in Dashboard

**File: `src/pages/app/DriverAppDashboard.tsx`**

Change line 185:
```
.eq('assigned_user_id', session.driverId)
```
to:
```
.eq('assigned_driver_id', session.driverId)
```

#### Step 2: Integrate iOS Background Tracking into Dashboard

**File: `src/pages/app/DriverAppDashboard.tsx`**

- Import `useIOSBackgroundTracking` 
- Call it alongside the existing `useBackgroundLocationTracking`
- On native iOS, the transistorsoft plugin handles persistent background tracking (survives app close, phone lock, reboot)
- On web, the existing browser `watchPosition` remains as fallback
- Wire the iOS tracking's location data into the dashboard's `currentLocation`, `speed`, `heading`, and `accuracy` state

#### Step 3: Ensure iOS Hook Passes Driver Identity

**File: `src/hooks/useIOSBackgroundTracking.ts`**

The hook currently reads `driverId` from `localStorage.getItem('ftm_driver_id')` which is correct (set by DriverSessionContext). Verify this works and add the offline queueing that was recently added to `useBackgroundLocationTracking`.

#### Step 4: Update useBackgroundLocationTracking to Skip on Native iOS

**File: `src/hooks/useBackgroundLocationTracking.ts`**

Add a check: if running on native iOS, skip `watchPosition` to avoid duplicate tracking. Let `useIOSBackgroundTracking` handle it exclusively on native.

---

### Files to Modify

1. `src/pages/app/DriverAppDashboard.tsx` -- fix task column + integrate iOS background tracking
2. `src/hooks/useBackgroundLocationTracking.ts` -- skip on native iOS to avoid duplicates  
3. `src/hooks/useIOSBackgroundTracking.ts` -- ensure offline queueing is wired in (already done in prior fix)

### After Implementation

- You must **Publish** for Pat's app to pick up these changes
- Pat will then see assigned tasks on the dashboard and tasks page
- Location tracking will persist through app backgrounding, switching apps, and screen lock on iOS
- On device reboot, tracking auto-starts (configured with `startOnBoot: true` in the plugin)

