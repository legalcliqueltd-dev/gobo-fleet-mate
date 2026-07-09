# UI/UX Round 4 — Approved Checklist (2026-07-09)

Owner-approved plan. Execute top to bottom. **No backend/Supabase changes anywhere.**
Status legend: [ ] pending · [x] done

## 0. Map popup buttons (LiveDriverMap → DriverCard)
- [x] **Remove "Call Driver"** — no phone number exists anywhere in the data model
      (drivers connect with name + code only). A dead button is worse than none.
      Future work (needs backend): add `phone` column to drivers + collect it in
      driver-app Settings, then restore the button as `tel:` link.
- [x] **Make "Navigate" functional** — open Google Maps directions to the driver's
      live position: `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`
      in a new tab. File: `src/components/map/LiveDriverMap.tsx` (DriverCard component).

## 1. One card per person (FleetPanel join fix)
- [x] Duye currently appears twice: once as an orphan driver (ONLINE) and once as a
      "Waiting for driver" vehicle. Cause: `devices.connected_driver_id` is null for
      existing rows.
- [x] Add join fallback by code: `device.connection_code === driver.admin_code`.
      Check `useDriverLocations` selects `admin_code`; add to the select if missing
      (frontend read only). File: `src/components/FleetPanel.tsx` (slots useMemo).
- [x] Result check: one card — "Duye · ONLINE · Last seen HH:MM" with the code folded
      behind the small "Connection code" disclosure.

## 2. One marker per driver on the map (smaller car icon)
- [x] Dashboard currently draws the vehicle's last position (big orange car) AND the
      driver's live dot — same person twice.
- [x] In `src/pages/Dashboard.tsx`, filter `deviceMarkers` to exclude devices claimed
      by a driver (same join as item 1: connected_driver_id OR code match).
- [x] Redesign driver marker in `src/components/map/LiveDriverMap.tsx`
      (`createDriverMarkerIcon`): small car icon ~36px (44px selected) in the STATUS
      color (green/amber/gray), white outline. Keep the name label + accent dot below.
      Must be visible but never obscure the roads.

## 3. Panel click behavior (FleetPanel)
- [x] Single click on a driver card → map flies to that driver (already wired; keep).
- [x] **Double-click → navigate to `/driver/{driver_id}` details page.**
      Use a 250 ms click timer to distinguish. Keep the external-link icon as a
      secondary affordance.

## 4. Stats row simplification (Dashboard)
- [x] Remove the "Vehicles" card (1 driver = 1 vehicle; redundant).
- [x] Fix "Online": it currently counts DEVICE status (shows 0 while a driver is
      ONLINE). Count drivers with `last_seen_at` < 5 min — the same rule as the
      panel badge, so the two never contradict.
- [x] Final row: **Drivers** (total connected) · **Online now**. Two cards only.

## 5. SOS/Incidents map consistency
- [x] `src/pages/ops/Incidents.tsx`: apply `getMapStyle(isDark)` from
      `src/lib/mapStyles.ts` to the map options (currently Google default look),
      hide POIs, match control sizing with the dashboard map. Same product, one map
      language.

## 6. Driver app connect screen revamp (frontend-design pass)
- [x] `src/pages/app/DriverAppConnect.tsx`: stronger first impression on the
      Asphalt & Signal system — brand hero (logo + map-motif backdrop), the code
      entry as the single hero action, name field secondary.
- [x] DO NOT touch the connect logic, onboarding trigger, or error handling —
      presentation only.

## 7. Background tracking + offline queue (CRITICAL, native)
Goal: tracking survives app-switch/screen-lock; offline locations queue locally and
sync on reconnect.
- [x] Audit `src/services/trackingService.ts` + `src/hooks/useTrackingService.ts`:
      confirm what the offline queue already does (dashboard shows "N stored
      offline · Sync", so storage partly exists) and where flushing happens.
- [x] The installed `@capawesome-team/capacitor-android-foreground-service@8.1.0`
      targets Capacitor 8; app runs Capacitor 7 → the plugin silently never loads,
      so Android freezes JS soon after backgrounding. Install the newest
      **Capacitor-7-compatible** release of that plugin (check npm versions; install
      with `--legacy-peer-deps`).
- [x] Wire it in trackingService: START foreground service when driver goes on duty
      (persistent notification — "FleetTrackMate is tracking your location" — this
      is an Android requirement, not optional); STOP when off duty / disconnect.
- [x] Manifest: ensure `POST_NOTIFICATIONS` permission (Android 13+) in addition to
      the FOREGROUND_SERVICE* permissions the post-sync script already enforces.
- [x] Rebuild native: `export VITE_BUILD_TARGET=driver-native && npx vite build`,
      `bash scripts/prepare-driver-capacitor-config.sh`, `npx cap sync android`,
      `bash scripts/android-post-sync.sh` (strips Transistorsoft from Gradle AND
      capacitor.plugins.json — never skip), `node scripts/verify-android-platform.mjs`,
      then `cd android && JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"
      ./gradlew :app:assembleDebug`.
- [x] Verify APK at `android/app/build/outputs/apk/debug/app-debug.apk`:
      `assets/capacitor.plugins.json` lists camera + geolocation + foreground-service
      (NO transistorsoft), and the foreground-service classes exist in the dex.

## 8. Final verification
- [x] Web: `npm run build`, screenshot dashboard (one card, one marker, 2-stat row)
      and incidents map (themed) via playwright-core + msedge channel.
- [ ] Owner device test (manual): uninstall old app → install fresh APK → connect
      with code → grant location → go on duty → press Home, wait 10+ min → dashboard
      keeps updating → enable airplane mode, move around, disable → queued points
      flush ("Sync Queue" empties).

## Known context (do not re-derive)
- npm installs need `--legacy-peer-deps`.
- Bare `npx cap sync android` re-breaks the plugins JSON — always run the post-sync
  script after (or `npm run cap:sync:android`).
- Gradle CLI needs `JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"`.
- Temp tracking admin UI is removed by design; guest `/share/:token` stays dormant.
- Driver app maps = Leaflet (keyless); admin website maps = Google.
