

## Plan: Fix Android Location Detection

### Problem
The app loads from a remote URL (`fleettrackmate.com`) via Capacitor's `server.url`. In this mode, `Capacitor.isNativePlatform()` often returns `false` because the JavaScript runs in a remote web context — not from bundled assets. This causes the location tracking code to fall back to the browser `navigator.geolocation` API, which behaves unreliably inside an Android Capacitor WebView.

The `LocationBlocker` component already has a robust `detectNativePlatform()` helper that checks multiple signals, but the two critical tracking files still use the raw `Capacitor.isNativePlatform()` call:
- `useBackgroundLocationTracking.ts` (lines 185, 252, 264, 357)
- `DriverAppDashboard.tsx` (line 53)

### Fix

**1. Extract the robust detection helper into a shared utility**

Create `src/utils/platformDetection.ts` with the `detectNativePlatform()` and `isAndroid()` helpers currently duplicated in `LocationBlocker.tsx`.

**2. Update `useBackgroundLocationTracking.ts`**

Replace all `Capacitor.isNativePlatform()` calls with `detectNativePlatform()` so that on Android (even with remote URL loading), the Capacitor Geolocation plugin is used instead of the browser fallback.

**3. Update `DriverAppDashboard.tsx`**

Replace `Capacitor.isNativePlatform()` with `detectNativePlatform()` for the `isNativeIOS` check, and use `detectNativePlatform()` for the location watch effect guard (line 140-141).

**4. Update `LocationBlocker.tsx`**

Import from the shared utility instead of defining inline.

### Files Changed
- `src/utils/platformDetection.ts` — new shared helper
- `src/hooks/useBackgroundLocationTracking.ts` — use shared helper
- `src/pages/app/DriverAppDashboard.tsx` — use shared helper
- `src/components/driver/LocationBlocker.tsx` — import from shared helper

