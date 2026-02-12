
## Fix: Driver Not Showing on Admin Map Due to Accuracy Filtering

### Root Cause
The "test" driver IS sending location updates to the backend (confirmed in edge function logs). However, the GPS accuracy from the web preview is 183 meters, which exceeds the 30-meter threshold. The edge function skips storing any location with accuracy above 30m, resulting in zero rows in `driver_locations` -- so the admin map has nothing to display.

The heartbeat works fine (driver shows as "active"), but without any stored coordinates, the map cannot place the driver.

### The Fix

**Store all locations, but flag inaccurate ones.** Instead of completely rejecting low-accuracy positions, always store the location in `driver_locations` so the driver appears on the map. The admin dashboard can then display a visual indicator (e.g., a semi-transparent marker or accuracy ring) for approximate positions.

This ensures:
- Drivers always appear on the admin map once they send any location
- High-accuracy positions replace low-accuracy ones as GPS locks improve
- The admin can see the difference between precise and approximate locations
- Trail history (`driver_location_history`) still only stores accurate points to keep movement data clean

### Changes

#### 1. Edge Function (`supabase/functions/connect-driver/index.ts`)
- **Always upsert** `driver_locations` regardless of accuracy (so the driver shows on the map)
- Only insert into `driver_location_history` when accuracy is good (keeps trail clean)
- Include accuracy value in the stored location so the admin UI can distinguish precise vs approximate

#### 2. Admin Map Markers (optional visual improvement)
- No code changes strictly required -- the admin map already reads from `driver_locations` and displays markers
- The driver will simply start appearing once any location is stored

### Technical Details

Current behavior (lines 868-920 of connect-driver):
```
if (isAccurate) {
  // upsert driver_locations  <-- only stores if accuracy <= 30m
  // insert driver_location_history
} else {
  // returns { stored: false, reason: 'accuracy_too_low' }
}
```

New behavior:
```
// ALWAYS upsert driver_locations (so driver appears on map)
upsert driver_locations with current coordinates + accuracy

if (isAccurate) {
  // ALSO insert into driver_location_history (for clean trail data)
}
```

### What This Fixes
- "test" driver will immediately appear on the admin map at their approximate position
- Pat (or any driver) with temporarily poor GPS will still show on the map instead of vanishing
- Once GPS improves, the position automatically updates to the accurate one
- Trail/history data remains clean (only accurate points stored)

### Files Modified
1. `supabase/functions/connect-driver/index.ts` -- move `driver_locations` upsert outside the accuracy check
