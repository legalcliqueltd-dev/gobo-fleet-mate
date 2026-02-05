

# Fix: Accurate iOS Location Tracking & Driver Map Display

## Problems Identified

### 1. iOS Background Tracking Sends to Wrong Table
The `useIOSBackgroundTracking.ts` hook inserts locations into the `locations` table (device-based system), but the admin dashboard reads from `driver_locations` table (driver-based system). This is why connected drivers don't appear on the map.

### 2. Location Accuracy Threshold Too Lenient
- Current iOS threshold: 100m (good)
- Current backend threshold: 1500m (too lenient for precise tracking)
- Recommendation: Tighten to 50m for high-accuracy tracking

### 3. Missing Integration
The iOS hook doesn't call the `update-location` edge function which properly populates `driver_locations`.

---

## Solution

### Phase 1: Fix iOS Tracking to Use Driver System

**File: `src/hooks/useIOSBackgroundTracking.ts`**

Change the `sendLocationUpdate` function to call the `connect-driver` edge function with `action: 'update-location'` instead of direct database insert:

| Current | New |
|---------|-----|
| Insert to `locations` table via device ID | Call `connect-driver` edge function with driver ID |
| Uses `connected_driver_id` lookup | Uses `DriverSessionContext` for driver ID |

### Phase 2: Tighten Accuracy Filter

**File: `src/hooks/useIOSBackgroundTracking.ts`**

| Setting | Current | New |
|---------|---------|-----|
| Accuracy threshold | 100m | 50m |
| High accuracy mode | DESIRED_ACCURACY_HIGH | Keep same |
| Distance filter | 10m | 5m (tighter) |

**File: `supabase/functions/connect-driver/index.ts`**

| Setting | Current | New |
|---------|---------|-----|
| Accuracy threshold | 1500m | 50m |
| Config sent to app | accuracyThresholdM: 1500 | accuracyThresholdM: 50 |

### Phase 3: Add Driver Session Integration

**File: `src/hooks/useIOSBackgroundTracking.ts`**

- Import and use `DriverSessionContext` to get current driver ID
- Pass driver ID to edge function instead of looking up device ID

---

## Technical Changes

### 1. `src/hooks/useIOSBackgroundTracking.ts`

```typescript
// Change sendLocationUpdate to use edge function
const sendLocationUpdate = async (
  latitude: number,
  longitude: number,
  speed: number | null,
  accuracy: number | null
) => {
  // Get driver ID from session storage
  const driverId = localStorage.getItem('driverId');
  if (!driverId) return;

  try {
    const { data, error } = await supabase.functions.invoke('connect-driver', {
      body: {
        action: 'update-location',
        driverId,
        latitude,
        longitude,
        speed: speed || 0,
        accuracy: accuracy || 0,
        isBackground: true,
      }
    });

    if (error) throw error;
    lastSentRef.current = Date.now();
  } catch (error) {
    console.error('Error sending location update:', error);
  }
};
```

### 2. Tighten accuracy filter in `onLocation`:

```typescript
// Line 133-137: Change from 100m to 50m
if (location.coords.accuracy > 50) {
  console.log('[BackgroundGeolocation] Skipping low accuracy location:', location.coords.accuracy);
  return;
}
```

### 3. `supabase/functions/connect-driver/index.ts`

Update the `update-location` action:

```typescript
// Line 413: Change from 1500 to 50
const isAccurate = accuracyValue <= 50;

// Lines 151-156 and 221-226: Update config
config: {
  locationUpdateIntervalMs: 15000,
  heartbeatIntervalMs: 30000,
  stationaryIntervalMs: 60000,
  lowBatteryIntervalMs: 120000,
  accuracyThresholdM: 50,  // Changed from 1500
}
```

---

## Why Only "John" Shows

Looking at the database:
- **John** has location in `driver_locations`: lat 4.8156, lng 7.0498
- **Duye** and others have `NULL` latitude/longitude in `driver_locations`

This happens because their iOS app isn't sending locations via the `connect-driver` edge function - it's using the old device-based system.

---

## Summary of Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useIOSBackgroundTracking.ts` | Use edge function, tighten accuracy to 50m, use driver ID from localStorage |
| `supabase/functions/connect-driver/index.ts` | Tighten accuracy threshold from 1500m to 50m in all places |

---

## Expected Result

After these changes:
1. iOS app will send accurate locations (< 50m accuracy) to `driver_locations`
2. All connected drivers will appear on the admin map
3. Location data will be precise and reliable
4. Battery and background status will be preserved

