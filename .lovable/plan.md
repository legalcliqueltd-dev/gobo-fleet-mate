
Goal: Fix (1) Pat not receiving tasks in the Driver App and (2) iOS “offline/background” tracking reliability.

What’s happening (confirmed from code + DB)
1) Tasks not showing on driver app:
- The driver app uses the Supabase anon client with no Supabase Auth session (by design).
- The `tasks` table has RLS policies that only allow SELECT when `assigned_user_id = auth.uid()` or admin role.
- Pat’s driver app has no `auth.uid()`, so every `supabase.from('tasks').select(...)` returns 0 rows (or a permission error), even though the tasks exist in DB.
- Verified tasks exist for Pat:
  - `public.tasks` rows where `assigned_driver_id='661b4ce7-aa59-4479-9854-d72490ef3bfc'` are present with `status='assigned'`.

2) iOS offline/background tracking:
- `useIOSBackgroundTracking` currently sends locations via JS (`supabase.functions.invoke`) and queues to `OfflineQueue` when it detects offline/failure.
- This approach breaks in the exact scenarios you care about:
  - When the app is backgrounded/terminated, JS may not run reliably.
  - “Offline tracking” needs native persistence + native retry, not localStorage queueing.
- Transistorsoft BG Geo already includes a native SQLite buffer + native HTTP service that:
  - stores locations while offline,
  - retries on connectivity changes / heartbeat / iOS background fetch,
  - can keep working when the UI is not open.

Important limitation (so expectations are correct)
- No app can track location when the phone is fully powered off (battery removed / shutdown).
- We can track when the screen is off, when the app is in the background, and (within iOS limits) after the user swipes away the app, as long as:
  - Location permission is set to “Always”
  - Background modes are enabled
  - The OS does not aggressively suspend due to permissions/settings

--------------------------------------------------------------------------------
Implementation plan (step-by-step)
--------------------------------------------------------------------------------

A) Fix tasks for driver app without weakening security (RLS-safe)
1) Extend the existing Edge Function `connect-driver` with new actions:
   - `action: "get-tasks"`
     - Input: `driverId`, `adminCode`, optional `statuses` list
     - Server validates:
       - driver exists
       - driver.admin_code matches adminCode
     - Server returns tasks filtered by:
       - `assigned_driver_id = driverId`
       - `admin_code = adminCode`
       - status filter (default: `['assigned','en_route','completed']`)
   - `action: "get-task"`
     - Input: `taskId`, `driverId`, `adminCode`
     - Same validation; returns a single task row (minimal fields needed in driver UI)

Why this works:
- Edge function uses service role internally, so it can read tasks regardless of RLS.
- We still enforce access by checking `(driverId + adminCode)` match, preventing random reads.

2) Update the driver app pages to use the edge function (instead of direct table queries):
   - `src/pages/app/DriverAppDashboard.tsx`
   - `src/pages/app/DriverAppTasks.tsx`
   - (Recommended) `src/pages/app/DriverAppCompleteTask.tsx` for loading the task details safely

3) Replace Realtime subscriptions for driver tasks with polling:
   - Realtime also respects RLS; anon users won’t receive task change events.
   - Implement a lightweight poll:
     - on screen focus/mount: fetch immediately
     - then every 15–30s while app is in foreground
     - pause polling when the tab/app is not visible (`document.visibilityState`)

4) Fix unread badge logic in driver layout:
   - `src/hooks/useTaskNotifications.ts` currently queries `tasks` directly and subscribes to Realtime.
   - Replace with edge-function polling:
     - Fetch assigned tasks list (or a `get-task-unread-count` action).
     - Detect “new task” by comparing IDs from last poll, then play sound + toast.

Deliverable result:
- Pat sees tasks immediately in the driver app after publish (no RLS changes needed).

--------------------------------------------------------------------------------

B) Make iOS tracking truly “background + offline capable”
1) Install missing iOS native dependency (fix build failure)
- Add dependency: `@transistorsoft/capacitor-background-fetch`
- This resolves the `_OBJC_CLASS_$_TSBackgroundFetch` linker error.

2) Change iOS tracking to use Transistorsoft native HTTP + persistence
Update `src/hooks/useIOSBackgroundTracking.ts`:
- Configure `BackgroundGeolocation.ready({...})` with:
  - `url: "https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver"`
  - `autoSync: true`
  - `batchSync: true` (optional but recommended)
  - `autoSyncThreshold: 3` (or 1 if you want immediate uploads; 3 saves battery)
  - `maxBatchSize: 50`
  - `params: { action: "update-location", driverId, adminCode, isBackground: true }`
  - optional: `headers: { apikey: <anon key> }` (not strictly required for your current edge function, but can help standardize)
- Add `BackgroundGeolocation.onHttp(...)` logging (and optionally `onConnectivityChange`) to confirm native sync is working.
- Keep the `onLocation` listener only for updating UI state (map marker / status), not for manual `supabase.functions.invoke` (to avoid duplicates).
- Ensure listeners are unsubscribed on cleanup to prevent duplicated callbacks.

Why this fixes “offline tracking”:
- The plugin will persist every location in native SQLite when offline.
- When internet returns, it automatically uploads the backlog to your edge function.

3) Update the edge function `connect-driver` to accept Transistorsoft HTTP payloads
Currently `update-location` expects:
- `latitude`, `longitude`, `accuracy`, `speed`, etc at the top-level request body.

But Transistorsoft HTTP posts:
- `{ location: { coords: { latitude, longitude, accuracy, speed, heading }, battery: { level }, timestamp, ... } }`
- (and with batchSync it may send multiple records; typically `{ locations: [...] }`)

So we’ll update `connect-driver`:
- If top-level `latitude/longitude` missing, look for:
  - `body.location.coords.latitude` / `body.location.coords.longitude`
  - `body.locations[i].coords.latitude` / etc (batch)
- Convert units when parsing plugin payload:
  - `speed` from plugin is m/s → convert to km/h (`* 3.6`) before validation/storage
  - `battery.level` is 0..1 → convert to 0..100
  - use `heading` as `bearing`
- For batch payload:
  - process locations in order
  - update `drivers.last_seen_at` once
  - upsert `driver_locations` using the newest accurate point
  - insert `driver_location_history` for each accurate point (or just newest N to limit load)

4) Make DriverAppDashboard reflect iOS native tracking state (UI correctness)
Right now:
- `DriverAppDashboard` calls `useIOSBackgroundTracking(...)` but does not use its `lastLocation/lastUpdate/isTracking`.
- `useBackgroundLocationTracking` sets `isTracking=true` on native iOS and returns early, so the UI can say “Tracking Active” even if the native engine failed.

Update `src/pages/app/DriverAppDashboard.tsx`:
- Detect native iOS (same check used in hooks).
- If native iOS:
  - Use `iosTracking.isTracking`, `iosTracking.lastUpdate`, `iosTracking.lastLocation` to set UI:
    - marker position
    - accuracy display
    - speed/heading
    - last sync time
  - Disable the browser `navigator.geolocation.watchPosition` UI watcher on iOS to reduce battery and avoid conflicting readings.
- If web / non-native:
  - keep existing browser watcher for UI.

5) Permission + iOS settings checklist (required for “always on”)
- Ensure the app requests “Always” authorization (you already set `locationAuthorizationRequest: 'Always'`).
- In Xcode target:
  - Capabilities → Background Modes:
    - Location updates
    - Background fetch (recommended since the plugin uses it for retry)
- On the device:
  - Settings → App → Location → Always
  - Location Services ON

Deliverable result:
- When Pat switches apps, locks phone, or briefly loses internet, tracking continues and syncs later.
- If Pat force-kills the app, tracking still generally continues with this plugin configuration (subject to iOS behavior and permissions), and queued locations sync when possible.

--------------------------------------------------------------------------------

C) Deployment / “Do we need to update the app?”
Because your Capacitor config uses:
- `server.url: 'https://fleettrackmate.com/app?...'`

This means:
- Web code changes (task fetching UI changes, hook logic changes) take effect after you Publish on Lovable.
- Native plugin dependency changes (background-fetch install) require a native rebuild once.

Step-by-step for you after I implement changes:
1) Publish the web app (so Pat’s driver app loads the new task-fetching logic immediately).
2) Rebuild iOS once (native dependency fix):
   - Export to GitHub → git pull
   - `npm install` (this brings in `@transistorsoft/capacitor-background-fetch`)
   - `npx cap sync ios`
   - `cd ios/App && pod install && cd ../..`
   - Build in Xcode / distribute via TestFlight
3) On Pat’s phone:
   - Open the app once
   - Confirm permission is “Always”
   - Test offline: turn off data for 2–5 minutes, move, turn data back on, confirm backlog syncs

--------------------------------------------------------------------------------
Testing plan (what we will verify)
1) Tasks:
- Create a new task assigned to Pat (admin UI).
- Open Pat Driver App → Tasks page should show it within 0–30 seconds (polling interval).
- Badge count updates as tasks arrive.

2) iOS offline/background tracking:
- With app in background, confirm edge function continues receiving updates (or later uploads).
- Turn on airplane mode for a few minutes:
  - confirm no hard failures and that sync resumes once online
- Kill the app:
  - verify whether location continues and uploads (depends on permission/settings; we’ll validate with edge logs)

3) Accuracy:
- Confirm `connect-driver` continues to store only points with accuracy <= 30m (already implemented).
- Ensure iOS plugin payload conversions keep speed/battery accurate.

Files/areas that will be changed (implementation scope)
- `supabase/functions/connect-driver/index.ts` (new actions + accept plugin payload + batch handling)
- `src/pages/app/DriverAppDashboard.tsx` (use iOS hook state; disable duplicate browser watch on iOS; task loading via edge function)
- `src/pages/app/DriverAppTasks.tsx` (task loading via edge function + polling)
- `src/hooks/useTaskNotifications.ts` (edge-function polling notification)
- `src/hooks/useIOSBackgroundTracking.ts` (native HTTP autoSync config + cleanup + UI state updates)
- `package.json` (add `@transistorsoft/capacitor-background-fetch`)

Notes on future hardening (optional but recommended)
- Add a lightweight shared secret header for driver updates to reduce spoofing risk, or require `adminCode` match for every update-location call (we can make this required once all clients send it).

If you approve this plan, I’ll implement it and then we’ll do a quick end-to-end verification with Pat (tasks + background/offline tracking) using edge logs and the admin dashboard trail.