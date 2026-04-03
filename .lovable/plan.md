
Root cause found: the location prompt failure is coming from the Android/native permission flow in `src/components/driver/LocationBlocker.tsx`, with a secondary risk in `src/utils/driverAppConnection.ts`.

What I checked:
- `src/components/driver/LocationBlocker.tsx`
- `src/hooks/useBackgroundLocationTracking.ts`
- `src/utils/driverAppConnection.ts`
- `src/utils/nativeGeolocation.ts`
- `src/utils/platformDetection.ts`
- `src/pages/app/DriverAppDashboard.tsx`
- `capacitor.config.ts`
- `package.json`
- `docs/ROCKET_LOCATION_PERMISSION.md`

Exact cause:
1. `LocationBlocker.tsx` is the gate that must succeed before the driver dashboard loads.
2. In `requestPermission()`, it calls:
   `Geolocation.requestPermissions({ permissions: ['location'] })`
3. But elsewhere in this project, the working/native-safe path already uses:
   `Geolocation.requestPermissions()`
   with no arguments:
   - `src/hooks/useBackgroundLocationTracking.ts:270`
   - project docs also show the no-arg version as the main flow
4. That means the blocker is using a different, outdated permission call signature than the rest of the app.
5. When that native call fails, `LocationBlocker` falls back to browser geolocation:
   - `await requestBrowserPermission()`
   - `await tryBrowserGeolocation()`
6. That fallback is the wrong recovery path for Android Capacitor native flow, because the app is supposed to rely on the native plugin once available. So the permission dialog may appear, but the blocker never transitions cleanly to granted.

Why this is the most likely exact issue:
- The failure point is inside the gating component that blocks the whole driver app.
- The permission call in that component is inconsistent with the newer working code in the tracking hook.
- The fallback behavior masks the true native failure and can leave the app stuck.
- Your own project memory/docs already indicate native geolocation must use the real Capacitor bridge and bundled assets.

Additional issue I found:
- `src/utils/driverAppConnection.ts` also still uses the same outdated call:
  `Geolocation.requestPermissions({ permissions: ['location'] })`
- Even if the blocker is fixed, this should also be updated to prevent the same bug elsewhere.

Native config risk I could not fully verify:
- The repo snapshot currently does not contain the real Android native project files.
- `android/` only shows `local.properties`; there is no `AndroidManifest.xml`, Gradle files, or plugin registration files available to inspect.
- So I cannot confirm from code whether the Android shell is currently healthy.
- If your local Android project is stale, that could also contribute, but it is not the primary code-level root cause I found here.

Implementation plan:
1. Update `src/components/driver/LocationBlocker.tsx`
   - Replace `Geolocation.requestPermissions({ permissions: ['location'] })`
   - Use `Geolocation.requestPermissions()` only
2. Remove Android-native browser fallback from the blocker
   - If native plugin path is active, keep the flow native
   - After request, immediately re-check permission and/or call `getCurrentPosition()`
3. Update `src/utils/driverAppConnection.ts`
   - Replace the same outdated permission call there too
4. Keep `useBackgroundLocationTracking.ts` as the reference implementation
   - It already uses the correct no-arg permission request
5. After code fix, verify on Android end to end
   - open app
   - trigger permission gate
   - allow location
   - confirm blocker dismisses
   - confirm dashboard loads
   - confirm tracking starts

Technical notes:
- Problem file: `src/components/driver/LocationBlocker.tsx`
- Bad call:
  `Geolocation.requestPermissions({ permissions: ['location'] })`
- Good call already present elsewhere:
  `Geolocation.requestPermissions()`
- Secondary cleanup file:
  `src/utils/driverAppConnection.ts`

If we implement this, I would treat the blocker mismatch as the main fix, then test on Android immediately before doing any broader refactor.
