

## Goal
Make iOS background + offline tracking actually persist and resume.

## Root causes found

1. **Transistorsoft `params` baked once with empty values.** In `useIOSBackgroundTracking.ts` (line 147-183), `BackgroundGeolocation.ready({ params: { driverId, adminCode, ... }})` is called once at mount. If the session isn't ready yet (or after a fresh install), `params.driverId` is `''`. The native SQLite queue keeps recording points but every auto-sync POST hits the edge function with `driverId: ""` → 400 error → points never clear. We never call `BackgroundGeolocation.setConfig({ params })` when the session id arrives.

2. **No JS-level offline write on iOS.** `useIOSBackgroundTracking.onLocation` only updates React state. It never calls `addOfflineLocation`. So when the iOS WebView is collapsed and Transistorsoft auto-sync fails, the IndexedDB queue stays empty and the `OfflineQueue` badge always shows zero — exactly what the user reported.

3. **`OfflineQueue` component not mounted on the driver dashboard**, so the user can't see pending counts or trigger a manual sync.

4. **`stopOnTerminate: false` + `startOnBoot: true` are set, but `enableHeadless: true` is also true** — that's fine. However iOS Background Modes need `location` + `processing` registered. Per memory `mem://deployment/ios/background-tasks` the BGTaskScheduler identifiers are added, but we should verify `Info.plist` has both `location` and `fetch` modes via `scripts/ios-post-sync.sh`.

5. **Heartbeat update from UI runs only when WebView is alive.** When iOS suspends the WebView, only Transistorsoft's native HTTP keeps the heartbeat fresh. If its `params` are wrong (cause #1), `last_seen_at` stops updating → driver shows offline.

## Fix plan

### A. `src/hooks/useIOSBackgroundTracking.ts`
- After `ready()` succeeds, expose a `setConfig` effect that re-pushes `params: { driverId, adminCode, ... }` whenever `driverIdRef`/`adminCodeRef` change — so Transistorsoft's native auto-sync POSTs always carry valid IDs.
- Defer `start()` until both `driverId` and `adminCode` are non-empty.
- In `onLocation`: also write the point to IndexedDB via `addOfflineLocation` so the JS-side queue mirrors what's pending. Trim it on successful `onHttp` 2xx by clearing the matching IDs.
- In `onHttp`: when `response.success === false`, leave the IndexedDB copy in place so the `drainOfflineQueue` retry can flush via the JS path even if Transistorsoft's native retry is stuck.
- Switch `autoSyncThreshold: 5` and enable `batchSync: true` so single failures don't block the queue forever, with `maxRecordsToPersist: 10000` for power-off resilience.
- Add `notification.title/text` and `foregroundService: true` config (already iOS-noop) for clarity.

### B. `src/pages/app/DriverAppDashboard.tsx`
- Mount `<OfflineQueue />` at top of the dashboard so the badge & "Sync" button are always visible to drivers.
- Surface `iosTracking.pendingOfflineCount` next to the "Live/Off" pill.

### C. `src/components/OfflineQueue.tsx`
- Currently `syncOfflineLocations` reads `driverId/adminCode` from the first record only. Fall back to `localStorage.ftm_driver_id` / `ftm_admin_code` so the manual "Sync" button works even before any record exists.

### D. `scripts/ios-post-sync.sh`
- Verify (and add if missing) `UIBackgroundModes` includes both `location` and `fetch`, plus `BGTaskSchedulerPermittedIdentifiers` for `com.transistorsoft.fetch` and `com.transistorsoft.customtask`. This guarantees iOS keeps the app alive when collapsed.

### E. Driver session bootstrap
- In `DriverSessionContext`, when `setSession(...)` is called, also write `localStorage.setItem('ftm_driver_id', ...)` and `ftm_admin_code` so the Transistorsoft cold-start path (when JS hasn't rehydrated React state yet) reads valid values.

### F. Honest expectation on "device turned off"
Once a phone is fully powered off, no app can record GPS — the OS isn't running. What we *can* guarantee:
- Records buffered in Transistorsoft's native SQLite + IndexedDB persist across reboot.
- On boot, `startOnBoot: true` re-arms the tracker and queued points flush as soon as network returns.

I'll add a one-line note in the diagnostics screen explaining this so it's not mistaken for a bug.

## Verification steps after deploy
1. Reconnect a driver, confirm `localStorage.ftm_driver_id` is set.
2. Run app, collapse for 2 min, reopen → DB shows points with timestamps from the gap.
3. Enable Airplane Mode 1 min → `OfflineQueue` badge shows pending count.
4. Disable Airplane Mode → badge drains within ~60 s; `driver_location_history` rows appear.

