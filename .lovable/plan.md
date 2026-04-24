
## Fix iOS driver background tracking

The current evidence points to the iOS app likely falling back to foreground-style Capacitor geolocation instead of the Transistorsoft native background tracker. The active `capacitor.config.ts` does not include the iOS Transistorsoft plugins, while the driver-specific config does. If iOS is synced with the wrong config, background tracking will not survive lock/background/termination.

## Changes I will make

### 1. Make iOS sync use the correct driver config

**Files**
- `package.json`
- `capacitor.config.driver.ts`
- `capacitor.config.ts` if needed

Add dedicated iOS scripts so the iOS driver app cannot accidentally be synced with the Android/web-oriented config:

```json
"cap:sync:ios": "cp capacitor.config.driver.ts capacitor.config.ts && npx cap sync ios && bash scripts/ios-post-sync.sh",
"cap:build:ios": "cp capacitor.config.driver.ts capacitor.config.ts && npm run build && npx cap sync ios && bash scripts/ios-post-sync.sh"
```

This ensures iOS includes:
- `@transistorsoft/capacitor-background-geolocation`
- `@transistorsoft/capacitor-background-fetch`
- local bundled assets, not remote preview loading
- required iOS background configuration

### 2. Harden the iOS Transistorsoft startup path

**File**
- `src/services/trackingService.ts`

Update the iOS startup logic to:
- explicitly confirm Transistorsoft is loaded
- request/upgrade iOS location permission through Transistorsoft using `locationAuthorizationRequest: 'Always'`
- check provider state after permission request
- only mark tracking active after `BG.start()` succeeds
- log the native plugin state clearly for Xcode debugging
- keep `stopOnTerminate: false`, `startOnBoot: true`, `preventSuspend: true`, `pausesLocationUpdatesAutomatically: false`
- add `disableStopDetection: true` or equivalent always-on movement behavior for driver mode so iOS is less likely to pause tracking too aggressively while the driver app is on duty

### 3. Use modern Transistorsoft config shape while preserving compatibility

**File**
- `src/services/trackingService.ts`

The current code uses the older flat config style. The plugin docs now prefer grouped config sections:

```ts
{
  geolocation: { ... },
  app: { ... },
  http: { ... },
  persistence: { ... }
}
```

I will switch to the modern grouped config while keeping safe legacy fields where needed, since the dependency is `@transistorsoft/capacitor-background-geolocation@8.0.1`.

This reduces the chance that important iOS lifecycle options are ignored.

### 4. Fix permission flow for iOS background access

**Files**
- `src/components/driver/LocationBlocker.tsx`
- `src/services/trackingService.ts`

The blocker currently checks Capacitor Geolocation permission, which can report regular location access but does not guarantee iOS “Always” background access.

I will update native iOS behavior so:
- the dashboard still blocks when location is unavailable
- iOS tracking startup attempts the Transistorsoft “Always” permission upgrade
- if iOS only has “While Using”, the user gets a clear message to enable:
  `Settings > FleetTrackMate > Location > Always`
- the app does not silently show “Tracking Active” if the native background tracker is not actually running

### 5. Improve diagnostics for iOS background tracking

**File**
- `src/pages/app/LocationDiagnostics.tsx`

Add iOS-specific Transistorsoft checks:
- plugin import success/failure
- `BG.getState()`
- `BG.getProviderState()`
- native enabled/disabled state
- authorization status
- native SQLite queue count
- current config summary
- a “Start Native Tracker” / “Force Native Sync” check path

This will make it obvious whether the app is running:
- native background tracking, or
- foreground-only fallback tracking

### 6. Confirm backend payload path

**File**
- `supabase/functions/connect-driver/index.ts`

Review and adjust the `update-location` handling if needed so Transistorsoft native HTTP payloads always work for:
- single native location payloads
- batched `locations: [...]` payloads
- `isBackground: true`
- speed conversion from m/s to km/h
- battery conversion from 0–1 to 0–100

The server already has most of this support, but I will make sure the native path is logged clearly so we can distinguish true background updates from foreground JavaScript updates.

## Expected result

After rebuilding and syncing iOS with the correct config:

- Driver turns tracking on once.
- iPhone can be locked or app can be backgrounded.
- Native Transistorsoft tracking continues collecting locations.
- Locations are persisted in native SQLite if offline.
- Native queue syncs automatically when network returns.
- Admin map continues receiving driver location updates.
- Diagnostics clearly show whether native iOS background tracking is active.

## Required after code changes

Because this is Capacitor/native iOS functionality, after I apply the changes you will need to pull the project locally and run:

```bash
npm install
npm run cap:build:ios
npx cap open ios
```

Then in Xcode:
1. Clean Build Folder.
2. Confirm Background Modes includes Location updates and Background fetch.
3. Run on a real iPhone.
4. Set Location permission to “Always”.
5. Test by locking the phone and walking/driving a short distance.

I will also remind you to read the Capacitor/native mobile guidance after the implementation, since native plugin changes require local sync/build steps.
