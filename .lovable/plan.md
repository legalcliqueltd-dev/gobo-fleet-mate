
# Fix CapacitorGeolocation Import Error

## Problem

The iOS app loads a remote web URL (`https://fleettrackmate.com/app`) and several files directly import `@capacitor/geolocation` without checking if the code is running on a native platform. This causes errors because:

1. **`useBackgroundLocationTracking.ts`** - Directly imports and calls Capacitor Geolocation APIs without platform detection
2. **`driverAppConnection.ts`** - Same issue: no platform checks before using Capacitor APIs

The **`LocationBlocker.tsx`** component correctly implements platform detection with `Capacitor.isNativePlatform()`, but the tracking hook doesn't follow this pattern.

## Solution

Add platform detection to all files using Capacitor Geolocation. When running on web, fall back to the standard browser Geolocation API (`navigator.geolocation`).

---

## Files to Modify

### 1. `src/hooks/useBackgroundLocationTracking.ts`

**Changes:**
- Import `Capacitor` from `@capacitor/core`
- Wrap all Capacitor Geolocation calls with platform checks
- Use browser `navigator.geolocation` as fallback for web environments
- Handle the `watchId` type difference (string for Capacitor, number for browser)

```text
Before:
  import { Geolocation } from '@capacitor/geolocation';
  const permission = await Geolocation.checkPermissions();
  const watchId = await Geolocation.watchPosition(...);

After:
  import { Geolocation } from '@capacitor/geolocation';
  import { Capacitor } from '@capacitor/core';
  
  if (Capacitor.isNativePlatform()) {
    // Use Capacitor Geolocation
    const permission = await Geolocation.checkPermissions();
    ...
  } else {
    // Use browser navigator.geolocation
    navigator.geolocation.watchPosition(...);
  }
```

### 2. `src/utils/driverAppConnection.ts`

**Changes:**
- Import `Capacitor` from `@capacitor/core`
- Add platform detection before using Capacitor Geolocation
- Provide browser fallback for web environments

---

## Technical Details

### Platform Detection Pattern
```typescript
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

// Check platform before using Capacitor APIs
if (Capacitor.isNativePlatform()) {
  // Native iOS/Android - use Capacitor
  const status = await Geolocation.checkPermissions();
} else {
  // Web browser - use navigator.geolocation
  navigator.geolocation.getCurrentPosition(...);
}
```

### Watch ID Handling
The watch ID type differs between platforms:
- **Capacitor**: Returns `string`
- **Browser**: Returns `number`

Use a union type: `watchIdRef = useRef<string | number | null>(null)`

### Permission Handling
- **Native**: Use `Geolocation.requestPermissions()` to trigger the native dialog
- **Web**: Use `navigator.permissions.query()` and `navigator.geolocation.getCurrentPosition()` to trigger browser prompts

---

## Expected Outcome

After these changes:
- The app will load correctly on both native iOS and web preview
- Location tracking will work on native using Capacitor with background capability
- Location tracking will work on web using standard browser APIs
- No more import errors in the Xcode console
