

## Problem

The "Enable Location" button on the LocationBlocker screen does not trigger the native Android permission dialog. Drivers are stuck on this screen with no way to grant permission without manually navigating to device Settings.

**Root cause**: The app is served from a remote URL (`https://fleettrackmate.com/app`) via Capacitor's `server.url`. In this mode, `Capacitor.isNativePlatform()` can return `false` because the JavaScript runs in a remote web context rather than from bundled local assets. This causes the code to use the **browser geolocation API fallback**, which cannot trigger the native Android runtime permission dialog from within a WebView.

Even if `Capacitor.isNativePlatform()` does return `true`, the `@capacitor/geolocation` plugin's `requestPermissions()` call may conflict with the Transistorsoft background geolocation plugin, which registers its own geolocation handler and can intercept/block the standard permission flow due to the license validation error previously identified.

**Impact**: The entire app is non-functional — no tracking, no tasks, no SOS — because location is the gateway to all features.

---

## Plan

### Step 1: Add robust native platform detection

Instead of relying solely on `Capacitor.isNativePlatform()`, add a secondary check using `Capacitor.getPlatform()` and check for the presence of the Capacitor bridge on `window`. This ensures Android is correctly detected even when loading from a remote URL.

**File**: `src/components/driver/LocationBlocker.tsx`

- Add a helper: `const isNative = Capacitor.isNativePlatform() || (window as any).Capacitor?.isNativePlatform?.() || Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios'`
- Replace all `Capacitor.isNativePlatform()` calls with this helper

### Step 2: Add Android-specific permission request using App plugin

When on Android native, use `@capacitor/app` plugin's ability to open app settings as a reliable fallback, and ensure `Geolocation.requestPermissions()` is called with explicit permission types.

**File**: `src/components/driver/LocationBlocker.tsx`

- In `requestPermission()`, for Android specifically:
  1. Call `Geolocation.requestPermissions({ permissions: ['location'] })` with explicit types
  2. If that doesn't trigger the dialog, fall back to `Geolocation.getCurrentPosition()` which forces the system prompt
  3. Add a longer timeout (15s) for Android since the permission dialog blocks execution
- For `openSettings()` on Android, use the `@capacitor/app` plugin or Android intent URI (`intent://settings/...`) to reliably open app permission settings

### Step 3: Add console logging for debugging

Add detailed `console.log` statements at every decision point so you can diagnose exactly what's happening via Android Studio logcat or remote debugging:

- Log the result of `Capacitor.isNativePlatform()` and `Capacitor.getPlatform()`
- Log permission state before and after each request
- Log which code path (native vs browser) is being taken

### Step 4: Guard Transistorsoft plugin on Android

Prevent the Transistorsoft background geolocation plugin from initializing on Android, as its license validation failure may be interfering with the standard `@capacitor/geolocation` plugin.

**File**: `src/hooks/useIOSBackgroundTracking.ts`

- Add an early return if `Capacitor.getPlatform() !== 'ios'` before the dynamic import of the Transistorsoft plugin

---

## Technical Details

- `Capacitor.isNativePlatform()` checks if the bridge is available and the platform is not `web`. When using `server.url` with a remote domain, the bridge injection can be delayed or the check can fail on first load.
- Android WebView does not support `navigator.permissions.query()` for geolocation — it always returns `prompt` but cannot actually show the system dialog.
- `@capacitor/geolocation` plugin's `requestPermissions()` on Android triggers the native `ActivityCompat.requestPermissions()` call, which shows the system dialog — but only if the Capacitor bridge is properly connected.
- The Transistorsoft plugin registers as a geolocation provider at the native layer and can shadow the standard Capacitor geolocation plugin.

