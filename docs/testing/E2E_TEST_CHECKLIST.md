# FleetTrackMate — End-to-End Test Checklist

Use this checklist to verify every component and feature before a release.

---

## Landing / Public Pages (Web)

| # | Test | How to verify | ✅ |
|---|------|--------------|-----|
| 1 | Landing page loads | Visit `/` — Hero, Features, Pricing, Testimonials render | |
| 2 | Auth pages | `/auth/login`, `/auth/signup`, `/auth/forgot` load correctly | |
| 3 | Legal pages | `/privacy`, `/terms`, `/delete-account` render content | |
| 4 | Public share link | `/share/:token` loads map for a valid temp-share token | |

---

## Admin Dashboard (Web, requires login)

| # | Test | How to verify | ✅ |
|---|------|--------------|-----|
| 5 | Dashboard loads | `/dashboard` shows map, driver list, device list | |
| 6 | Live driver map | Connected drivers appear on map with real-time position | |
| 7 | Add device | `/devices/new` — create a device, verify it appears in list | |
| 8 | Driver details | Click a driver on map — details panel opens with trail, status | |
| 9 | Create task | `/admin/tasks/new` — create task with pickup/dropoff, assign to driver | |
| 10 | Task list | `/admin/tasks` — shows all tasks with status filters | |
| 11 | SOS incidents | `/ops/incidents` — shows SOS events, detail drawer with photo evidence | |
| 12 | Fleet analytics | `/analytics` — charts and stats load | |
| 13 | Geofences | `/geofences` — create/view geofence polygons on map | |
| 14 | Trips | `/trips` — trip history loads | |
| 15 | Temp tracking | `/temp-tracking` — create shareable tracking link | |
| 16 | Settings | `/settings` — profile, subscription, connection codes visible | |
| 17 | Payment flow | Pricing page → checkout → subscription activates | |
| 18 | Driver management | `/admin/drivers` — list, pause, remove drivers | |
| 19 | Location simulator | `/app/simulator` — simulate driver location updates | |

---

## Driver App (Mobile, code-based auth)

| # | Test | How to verify | ✅ |
|---|------|--------------|-----|
| 20 | Connect screen | `/app/connect` — enter name + code, connects successfully | |
| 21 | Location permission | LocationBlocker appears, "Enable Location" triggers native dialog (Android) | |
| 22 | Dashboard map | `/app/dashboard` — map shows driver position with car marker, tracking status, GPS quality | |
| 23 | On Duty tracking | Location updates appear on admin dashboard in real-time | |
| 24 | Task list | `/app/tasks` — assigned tasks appear, can navigate to dropoff | |
| 25 | Task navigation | Tap navigate icon — route renders on map with ETA/distance and turn-by-turn strip | |
| 26 | Complete task | `/app/tasks/:id/complete` — take photo, add notes, submit | |
| 27 | Camera capture (Android) | "Take photo" opens native camera, photo appears as preview | |
| 28 | Gallery select (Android) | "Add photo/video" opens gallery picker | |
| 29 | SOS trigger | `/app/sos` — hold button 3 sec, SOS event created, appears on admin | |
| 30 | SOS photo evidence | Capture photo during SOS, verify it uploads and shows on admin detail | |
| 31 | Settings | `/app/settings` — shows driver name, connection status, disconnect option | |
| 32 | Background tracking | Minimize app, verify admin still receives location updates | |
| 33 | Offline queue | Turn off network, trigger location updates, reconnect — updates sync | |
| 34 | Trail polyline | Drive around, blue trail line appears on driver map | |
| 35 | Heartbeat | Driver stays "Active" on admin even without movement | |
| 36 | Active task card | Bottom card shows active task with distance, navigate button, arrival detection | |
| 37 | Map auto-follow | Map follows driver position; dragging map disables follow; re-center button re-enables | |

---

## Android-Specific Tests

| # | Test | How to verify | ✅ |
|---|------|--------------|-----|
| 38 | Native permission dialog | Logcat shows NO "plugin not implemented" errors | |
| 39 | Camera plugin registered | Post-sync script reports `[OK] Camera plugin found` | |
| 40 | App loads from local assets | Logcat shows `https://localhost` (not a remote URL) | |
| 41 | Battery reporting | Battery level shows on admin dashboard for driver | |
| 42 | App survives backgrounding | Return to app after 5 min, map and tracking resume | |

---

## Cross-System Integration Tests

| # | Test | How to verify | ✅ |
|---|------|--------------|-----|
| 43 | Admin creates task → driver sees it | Create task on web, verify it appears on driver task list within 30s | |
| 44 | Driver completes task → admin sees update | Complete task with photo, verify admin task list shows "completed" with proof | |
| 45 | Driver triggers SOS → admin gets alert | Trigger SOS on driver app, verify admin SOS panel shows incident with location | |
| 46 | Geofence entry/exit | Driver enters a geofenced area, admin receives alert | |
| 47 | Temp share link | Admin creates share link, open in incognito browser — driver position visible | |

---

## Post-Build Verification (run after every `npx cap sync android`)

```bash
# Run the post-sync script:
powershell -ExecutionPolicy Bypass -File scripts/android-post-sync.ps1

# Expected output should include:
# [OK] Geolocation plugin found in ...
# [OK] Camera plugin found in ...
# [OK] Geolocation Android source found in node_modules
# [OK] Camera Android source found in node_modules
```

---

## Notes

- For Android testing, always uninstall the old APK before installing a new build
- The driver map now uses a car icon marker that rotates with heading
- Active task cards show distance and arrival detection (within 50m)
- Map auto-follows the driver; drag to explore, tap center button to re-follow
