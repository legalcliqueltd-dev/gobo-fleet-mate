
Do I know what the issue is? Yes.

The new Logcat screenshot changes the diagnosis completely: this is no longer mainly a permission-prompt problem. The app is throwing:

```text
[LocationBlocker] Permission request error: Error: "Geolocation" plugin is not implemented on android
```

That means the Android native Geolocation plugin is not available inside the running app, so the permission dialog can never appear from JavaScript. The current `requestPermissions()` code is being reached, but there is no native plugin behind it.

## What I will implement

### 1) Fix the real root cause: stop relying on remote `server.url` for Android production builds
Your current `capacitor.config.ts` loads:

```ts
server.url = 'https://fleettrackmate.com/app?forceHideBadge=true'
```

For Android, this is the most likely reason the Capacitor bridge/plugin injection is failing. The repo’s own mobile docs already say production builds should bundle local assets instead of using `server.url`.

Plan:
- Change `capacitor.config.ts` so Android production builds use bundled `dist/` assets by default
- Keep remote loading only as an explicit dev/debug option, not the default production path
- If needed, keep a separate config or env-based switch for remote hot-reload builds

### 2) Add a shared geolocation availability guard
Create a small helper to detect whether native geolocation is actually available before calling it.

Plan:
- Add a shared utility such as `src/utils/nativeGeolocation.ts`
- It will check:
  - native platform
  - `Capacitor.isPluginAvailable('Geolocation')`
  - fallback bridge signals on `window.Capacitor`
- It will return a clear “plugin unavailable” error instead of repeatedly trying permission calls

### 3) Update all location entry points to use the shared guard
Right now multiple places call `@capacitor/geolocation` directly.

Plan:
- Update `src/components/driver/LocationBlocker.tsx`
- Update `src/hooks/useBackgroundLocationTracking.ts`
- Update `src/utils/driverAppConnection.ts`

Each will:
- check plugin availability first
- request permission only if the plugin exists
- show a specific message when the native bridge/plugin is missing
- avoid misleading retries that can never succeed

### 4) Improve the blocker UI for this exact failure mode
Right now the blocker implies the user should keep tapping “Enable Location”.

Plan:
- Add a dedicated error state for:
  - native Android detected
  - Geolocation plugin unavailable
- Show a clearer message like:
  - “This build was installed without the Android geolocation bridge”
  - “Please rebuild the native app after syncing Capacitor”
- Keep the normal permission flow for valid builds

## Files to change
- `capacitor.config.ts`
- `src/components/driver/LocationBlocker.tsx`
- `src/hooks/useBackgroundLocationTracking.ts`
- `src/utils/driverAppConnection.ts`
- new shared helper, e.g. `src/utils/nativeGeolocation.ts`

## Why this plan should fix it
The screenshots show the app is successfully running in Android, but the Geolocation plugin itself is missing at runtime. That matches known Capacitor Android issues when apps are loaded from `server.url` / remote content and the bridge is not injected correctly. Until that is fixed, permission-dialog tweaks alone will not work.

## Validation after implementation
After the code/config changes, the rebuild flow should be:

```bash
git pull
npm install
npm run build
npx cap sync android
powershell -ExecutionPolicy Bypass -File scripts/android-post-sync.ps1
```

Then:
1. uninstall the current app from the device/emulator
2. reinstall the rebuilt app
3. open the blocker screen
4. tap “Enable Location”
5. confirm the Android system location dialog appears
6. confirm Logcat no longer shows:
```text
"Geolocation" plugin is not implemented on android
```

If the plugin error still appears after that, the next fallback step is to fully recreate the Android platform (`remove android` → `npx cap add android`) so the native project is regenerated with the correct Capacitor plugins.
