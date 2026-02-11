

## Fix Offline Tracking and Enable Trail Testing for Driver Pat

### Current Situation

Pat (driver `661b4ce7`) is marked "active" but has not sent any location data in the last 6 hours. Only 3 location records exist in the entire history. The offline queue system exists in code but is completely disconnected -- failed location sends are silently discarded, and the OfflineQueue component is never rendered.

### Plan

#### 1. Wire Offline Queueing into Location Tracking Hooks

**File: `src/hooks/useBackgroundLocationTracking.ts`**
- Import `queueOfflineAction` from `OfflineQueue`
- In the `sendLocationUpdate` catch block, instead of just logging the error, call `queueOfflineAction('location', { driverId, latitude, longitude, speed, accuracy, batteryLevel })` to persist the failed send in localStorage

**File: `src/hooks/useIOSBackgroundTracking.ts`**
- Same change: import `queueOfflineAction` and queue failed sends in the catch block of `sendLocationUpdate`

#### 2. Implement Real Supabase Sync in OfflineQueue

**File: `src/components/OfflineQueue.tsx`**
- Replace the `console.log` stubs in `syncQueue()` with actual Supabase edge function calls:
  - `location` type: invoke `connect-driver` with `action: 'update-location'`
  - `task_update` type: invoke Supabase table update
  - `sos` type: invoke `sos-create` edge function
  - `photo_upload` type: upload to Supabase storage
- Add a listener for the `offline-queue-updated` custom event so the component re-renders when new items are queued

#### 3. Mount OfflineQueue in the Driver App Layout

**File: `src/components/layout/DriverAppLayout.tsx`**
- Import and render `<OfflineQueue />` above the bottom navigation bar
- This makes the sync status visible to the driver at all times

#### 4. Add Network-Aware Location Sending

**File: `src/hooks/useBackgroundLocationTracking.ts`**
- Before calling the edge function, check `navigator.onLine`
- If offline, immediately queue the location data instead of attempting and failing
- This prevents unnecessary network timeouts and ensures instant queueing

#### 5. Database: Verify Pat's Tracking Pipeline

Run a diagnostic query to confirm Pat's driver session data matches what the tracking hooks expect (driverId and adminCode in localStorage). The edge function logs show Pat's `update-location` calls are firing every ~15 seconds, but the last location record is 6+ hours old. This suggests:
- Pat's phone may have lost GPS signal or the app was backgrounded/killed on web
- The connect-driver edge function may be filtering out locations (accuracy > 30m)

No database migration is needed for this fix.

### Technical Details

**Files to modify:**
1. `src/hooks/useBackgroundLocationTracking.ts` -- add offline queueing in catch block + online check
2. `src/hooks/useIOSBackgroundTracking.ts` -- add offline queueing in catch block
3. `src/components/OfflineQueue.tsx` -- replace console.log stubs with real Supabase calls, add event listener
4. `src/components/layout/DriverAppLayout.tsx` -- mount OfflineQueue component

**Testing the trail:**
After these changes, Pat's driver app will:
- Queue locations when offline and sync them when back online
- Show a visible sync queue indicator in the driver UI
- The trail polyline on the driver dashboard map will populate as location data flows in
- On the admin side, the Driver Details page will show Pat's location history trail

