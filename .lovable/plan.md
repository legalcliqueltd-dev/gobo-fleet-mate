

## Why you always see 0 pending

Two queues exist on iOS, and the badge is reading the wrong one:

1. **Transistorsoft's native SQLite** — where the plugin actually stashes points when the network fails. Survives airplane mode, app suspension, reboot. Accessible via `BackgroundGeolocation.getCount()` and `getLocations()`.
2. **Our IndexedDB mirror** — only gets a row when the JS `onLocation` callback fires.

When you turn on Airplane Mode while standing still, Transistorsoft suppresses `onLocation` (motion-detection optimization for battery). So nothing ever gets written to IndexedDB, and the badge shows 0 — even though Transistorsoft's native queue is silently filling up.

## Fix

Make the badge read from **Transistorsoft's real queue**, plus seed activity so we actually generate points to test with.

### A. `src/hooks/useIOSBackgroundTracking.ts`
- Add a `pollNativePendingCount()` helper that calls `BackgroundGeolocation.getCount()` and updates `pendingOfflineCount`. Poll every 5s while the hook is active, and immediately on `onConnectivityChange` and `onHttp`.
- Subscribe to `onConnectivityChange` to log online/offline transitions and trigger an immediate count refresh + `BackgroundGeolocation.sync()` when connectivity is restored.
- Force a synthetic location every heartbeat by calling `getCurrentPosition({ persist: true, samples: 1 })` so points accumulate even when the user is stationary (essential for the airplane-mode test to be visible).
- Keep the IndexedDB mirror as a secondary safety net, but make `pendingOfflineCount` = `nativeCount + indexedDbCount` so the user sees the union.
- Add a manual "Force sync" handler that calls `BackgroundGeolocation.sync()` and refreshes the count.

### B. `src/components/OfflineQueue.tsx`
- When `isNativeIOS`, also display "X queued in native SQLite" by reading via the new helper exported from the hook (or by importing the plugin lazily and calling `getCount()`).
- Manual Sync button: call `BackgroundGeolocation.sync()` first, then run the IndexedDB drain.
- Show the badge whenever **either** queue is > 0 (currently it hides when IndexedDB is empty).

### C. `src/pages/app/LocationDiagnostics.tsx`
- Add three buttons: **"Show native queue count"**, **"List native queued points"**, **"Force native sync"** — each calls `BackgroundGeolocation.getCount()`, `getLocations()`, `sync()` respectively and prints the result. This lets you verify the queue is filling during airplane mode without guessing.
- Add a one-line note explaining: "iOS suppresses location updates while stationary. To test offline, walk a few meters with Airplane Mode on."

### D. `src/hooks/useIOSBackgroundTracking.ts` — Transistorsoft config tweak
- Set `disableMotionActivityUpdates: true` and reduce `stationaryRadius: 5` so that stationary suppression is less aggressive during testing.
- Set `heartbeatInterval: 30` (already there) and ensure `preventSuspend: true` keeps the JS callback alive enough to fire `getCurrentPosition` every heartbeat.

## Verification after deploy
1. Open `/diagnostics` → tap **Show native queue count** → expect 0 initially.
2. Toggle Airplane Mode ON → wait 60s → tap again → expect count > 0 (heartbeat-driven points).
3. Walk 30m → tap again → count should grow further.
4. Turn Airplane Mode OFF → tap **Force native sync** → count drops to 0; new rows visible in `driver_location_history`.
5. On the dashboard, the "queued" badge should mirror the same numbers in real time.

