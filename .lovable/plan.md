## Fix Pat's Location Tracking + Admin Trail View

### The Problem

Pat's phone sends `update-location` every ~15 seconds, but **all requests fail with HTTP 400** because `latitude` and `longitude` arrive as `undefined`. The edge function rejects the entire request, so even the heartbeat (`last_seen_at`) stops updating after a while. Only 3 location history points exist total.

### Root Cause

Pat's app runs the **published production code** (from `fleettrackmate.com`), which has an older version of the tracking hooks where `watchPosition` fires but coordinates aren't properly passed through. The recent accuracy and offline fixes haven't been published yet.

### Plan

#### 1. Make Edge Function Resilient (server-side fix, deploys immediately)

**File: `supabase/functions/connect-driver/index.ts**`

Change the `update-location` handler so that when coordinates are invalid:

- Still update `last_seen_at` (heartbeat) to keep Pat showing as "active"
- Add diagnostic logging of raw coordinate values and their types
- Return HTTP 200 with a `warning` flag instead of HTTP 400
- Only skip storing the location in `driver_locations` and `driver_location_history`

This means even Pat's current (old) app will stop getting 400 errors and will properly maintain the heartbeat. Once the app code is published, valid coordinates will flow through.

#### 2. Add Client-Side Coordinate Guard

**File: `src/hooks/useBackgroundLocationTracking.ts**`

Add a check in `sendLocationUpdate` to skip sending if coordinates are not valid numbers:

```
if (typeof latitude !== 'number' || isNaN(latitude) || typeof longitude !== 'number' || isNaN(longitude)) {
  console.warn('Skipping invalid coordinates');
  return;
}
```

This prevents the client from spamming the edge function with invalid payloads.

#### 3. Ensure "Today" Time Range on Admin Trail

**File: `src/pages/DriverDetails.tsx**`

The admin Driver Details page already has a Trail/History tab with time range selectors (1h, 4h, 12h, 24h, 3d, 7d). The "24h" range covers today. No changes needed here -- once Pat starts sending valid locations, the trail will populate automatically.

### Files to Modify

1. `supabase/functions/connect-driver/index.ts` -- resilient coordinate handling + diagnostic logging
2. `src/hooks/useBackgroundLocationTracking.ts` -- client-side coordinate validation guard

### Do You Need to Update the App?

**Yes, but it's automatic.** After I make these changes:

1. The **edge function** deploys immediately -- Pat's 400 errors will stop right away
2. You need to **publish** from Lovable so the production site (`fleettrackmate.com`) gets the new client code
3. Pat just needs to **reopen the app** (or it will refresh on its own) -- no reinstall needed
4. Locations will start flowing and the trail will appear on the admin Driver Details page

### Expected Outcome

- Pat's heartbeat stays alive even with bad coordinates (immediate, via edge function)
- After publishing, Pat's app sends valid coordinates with high accuracy
- Admin can view Pat's trail on the Driver Details page under the "Trail/History" tab using the 24h time range