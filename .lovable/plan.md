
This response covers 6 distinct items. I'll address each with concrete fixes — the persistent tracking rebuild is the heaviest item.

## 1. Cleaner admin Driver Map + clickable history points

**File**: `src/components/map/DriverLocationMap.tsx`

- Replace the polyline-only history with **per-point clickable markers** (small dots, sized inversely by zoom). Click → `InfoWindow` with date, time, speed, accuracy, and "Point N of M".
- Group points within 20m and 60s into a single cluster marker to avoid map clutter.
- Cleaner UI: move legend + driver-info pill into a single collapsible top bar; reduce overlay opacity; use a single bottom-right control stack (recenter, fit-trail, layer toggle).
- Add a thin **scrubber timeline** below the map (slider) that highlights the corresponding marker on hover/drag — gives admin a "scrub through the day" view.

## 2. Persistent tracking — rebuild from scratch (most critical)

The current code stops tracking when leaving the dashboard because Transistorsoft was being torn down (or never started independent of the dashboard mount). And iOS shuts off the GPS arrow when the app is closed because `stopOnTerminate` was previously true at some point and the start/stop is gated by a React hook lifecycle.

**New architecture**: tracking becomes a **singleton service** that lives outside React, started once when the driver session is established and never stopped by component unmount.

### A. New file `src/services/trackingService.ts`
- Singleton class. Owns lifecycle of Transistorsoft (iOS) and Capacitor Geolocation watch + Android Foreground Service.
- `start(driverId, adminCode)` — idempotent. Configures plugin with `stopOnTerminate: false`, `startOnBoot: true`, `preventSuspend: true`, `enableHeadless: true`. Persists `{driverId, adminCode, isOn: true}` to localStorage.
- `stop()` — only called explicitly by user "Go Off Duty" toggle or logout. Never on unmount.
- `resumeFromStorage()` — called once at app boot from `main.tsx` if `isOn===true`. Re-arms the plugin without requiring the dashboard to mount.
- Emits events via `EventTarget` so React components subscribe for UI without owning lifecycle.

### B. New file `src/hooks/useTrackingService.ts`
- Thin React wrapper that subscribes to the singleton's events and returns `{ isTracking, lastLocation, pendingCount, ... }`.
- **No effect cleanup ever calls stop().** Only `start()` if not already running with current IDs.

### C. Wire-up changes
- `src/main.tsx` — call `trackingService.resumeFromStorage()` at boot.
- `src/pages/app/DriverAppDashboard.tsx` — replace `useIOSBackgroundTracking` and `useBackgroundLocationTracking` with `useTrackingService`. Remove the dashboard-scoped start/stop.
- `src/pages/app/DriverAppSettings.tsx` (On/Off duty toggle) — explicit `trackingService.start()` / `stop()`.
- Delete the dashboard-mount-scoped `useEffect` cleanups in both old hooks; mark old hooks as deprecated wrappers around the service for backward compat, then remove their start/stop entirely.

### D. iOS app-close behavior
- Confirm `Info.plist` has `UIBackgroundModes`: `location`, `fetch`, `processing` (already present per `mem://deployment/ios/background-tasks`).
- Set Transistorsoft `stopOnTerminate: false` and `enableHeadless: true` (currently true, but verify Capacitor not killing it).
- Do NOT call `BackgroundGeolocation.stop()` from any React cleanup. Currently `useIOSBackgroundTracking.ts` line ~321 has `if (!enabled) stopTracking()` — this fires when dashboard unmounts because `enabled` becomes false. Move enable gating into the singleton.

### E. Offline persistence (already partially done)
- Keep IndexedDB mirror.
- Add periodic native `getCount()` poll in service (every 10 s) so offline queue badge works even when no React component is mounted.

## 3. Website blank pages + needs manual refresh

**Likely causes**:
- `TaskList` `useEffect` depends on `[filterStatus, user]` but on first nav `user` may be `null` while auth is still loading → `loadTasks` returns early and never re-runs because the realtime channel is also gated on `user`.
- Realtime subscriptions in admin pages don't re-fire on tab-resume.

**Fixes**:
- `src/pages/admin/TaskList.tsx`: gate render on `loading` state; ensure `loadTasks` re-runs once `user` becomes truthy (already in deps but the `subscribeToTasks()` is created even when `user` is null, leaking channel). Add early return + add a `visibilitychange` listener that calls `loadTasks()` on tab resume.
- Add the same `visibilitychange` resume pattern to `Dashboard.tsx`, `Incidents.tsx`, and `DriverDetails.tsx` — single small hook `useRefreshOnVisible(callback)` in `src/hooks/useRefreshOnVisible.ts`.
- Add a top-level `<ErrorBoundary>` in `App.tsx` so a render error on Tasks shows a fallback instead of white screen.

## 4. Universal back button (web + driver app)

- New component `src/components/ui/BackButton.tsx` — uses `useNavigate(-1)` with fallback to `/dashboard` (web) or `/app/dashboard` (driver) when there's no history.
- **Web**: Inject into `AppLayout.tsx` — render at top-left of `<main>` automatically, hidden on routes: `/`, `/dashboard`, `/admin`, `/admin/dashboard`.
- **Driver app**: `DriverAppLayout.tsx` already has a back button — verify it's shown on all non-home pages (it currently is). No change needed beyond ensuring `/app/diagnostics` and other sub-pages render with the layout.

## 5. Landing page — strip nav bar

- `src/App.tsx` — extract Landing from `<AppLayout>` so it renders standalone (like `/share/:token` already does).
- Add a single floating top-right button on Landing: "Go to Dashboard" (if logged in) / "Sign In" (if not). Component: `src/components/LandingTopButton.tsx`.
- Replaces both the trial banner and the full nav header on `/`.

## 6. Competitor analysis (research, no code)

I'll deliver this as a markdown document at `/mnt/documents/competitor_analysis.md` covering: Samsara, Verizon Connect, Geotab, Motive (KeepTruckin), Fleetio, Bolt, Onfleet, Circuit, Routific. For each: 3 standout features and how FleetTrackMate can match or differentiate (price, code-based driver onboarding, no-Apple-Auth flow, integrated SOS, temp share links). Plus a prioritized "build next" list.

## Order of execution

1. Persistent tracking singleton (#2) — biggest risk, do first.
2. Back button + Landing nav strip (#4, #5) — quick wins.
3. Map clickable points (#1).
4. Website blank-page fixes (#3).
5. Competitor doc (#6).

## Verification after deploy
- Driver: connect → close app fully → wait 3 min → reopen. Check `driver_location_history` for new rows in the gap.
- Driver: navigate from dashboard to Tasks → back → tracking still shows "Active" with no GPS arrow disappearing.
- Admin: open Driver Details → click any history dot → InfoWindow shows date/time/speed.
- Admin: hard-refresh `/admin/tasks` and also navigate to it from dashboard — both render content (no blank screen).
- Landing: visit `/` — no app navbar visible, only "Sign In / Dashboard" button top-right.
- Every non-home page on web and driver app: back arrow top-left.
