

# Fix: Android Location Permission Dialog Not Appearing

## What's happening

The Logcat shows LocationBlocker's console messages repeating in Info/Warn/Error triplets every few seconds. The Android system permission dialog is never appearing. This creates an infinite loop where the permission check keeps cycling via focus/visibility listeners.

## Root cause

On Android, Capacitor returns `"denied"` for both "never asked" AND "permanently denied" permission states — they are indistinguishable. Once the user has denied the permission (even once with "Don't ask again"), `Geolocation.requestPermissions()` silently resolves without showing any dialog. The current code doesn't detect this and keeps retrying, triggering focus/visibility events that restart the cycle.

Additionally, there's a known Capacitor Geolocation >=7.1.0 issue where `requestPermissions()` can hang in certain states.

## Plan

### 1. Add detailed diagnostic logging to LocationBlocker

Add `console.log` statements that output the exact `checkPermissions()` result (the `location` and `coarseLocation` values) so we can see in Logcat precisely what Android is returning. This helps confirm whether the status is `denied`, `prompt`, or something else.

### 2. Fix the permission re-check loop

The focus/visibility event listeners re-run `checkPermission()` every time the app regains focus. When the permission is `denied`, this creates an infinite retry loop. Fix:
- Add a `hasCheckedOnce` ref that prevents automatic re-checking after the initial check completes with `denied`
- Only allow manual re-check via the "Retry Check" button
- Remove or debounce the focus/visibility listener so it doesn't immediately re-trigger

### 3. Handle "denied" state properly on Android

When `checkPermissions()` returns `denied` on Android:
- Do NOT call `getCurrentPosition()` (it will fail/hang)
- Do NOT call `requestPermissions()` in a loop
- Instead, try `requestPermissions()` exactly once
- If still `denied` after the single attempt, show the "Open Settings" UI immediately with clear instructions
- Track whether we've already attempted the request to avoid repeating it

### 4. Improve the "Enable Location" button behavior

When the user taps "Enable Location":
- Call `Geolocation.requestPermissions()` once (no args, no timeout wrapper for the first attempt — let the OS dialog show naturally)
- If the result is still `denied`, show a toast/alert explaining they need to go to Settings
- If the result is `granted`, proceed normally

### 5. Fix the Settings deep-link for Android

The current `intent:` URL scheme may not work on all Android versions. Add a fallback that uses Capacitor's `App` plugin or `NativeSettings` approach, and always show a clear instructional alert as backup.

## Files to modify

- `src/components/driver/LocationBlocker.tsx` — all changes above

## After deploying

1. `npm run build`
2. `npx cap sync android`
3. `powershell -ExecutionPolicy Bypass -File scripts/android-post-sync.ps1`
4. **Uninstall the app from the device first** (`adb uninstall app.fleettrackmate.driver`) to clear cached permission state
5. Rebuild and install from Android Studio
6. On first launch, the system dialog should now appear; if it was previously permanently denied, the app will direct to Settings

