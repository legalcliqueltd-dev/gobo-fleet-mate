

# Comprehensive Test Plan and Feature Improvements

This plan covers three areas: (A) fixing the Android camera for SOS/task photos, (B) redesigning the driver delivery map to be more Bolt-like and easy to follow, and (C) a full end-to-end testing checklist for every component.

---

## Part A: Fix Android Camera Capture

**Problem:** The `@capacitor/camera` package is installed in `package.json` and the code in `nativeCamera.ts` uses it, but the Android post-sync script only verifies the Geolocation plugin -- it does not verify the Camera plugin. More critically, the Camera plugin may not be registered in the Android Gradle files after a sync (same issue that affected Geolocation).

**Changes:**
1. Update `scripts/android-post-sync.ps1` and `scripts/android-post-sync.sh` to also verify the `@capacitor/camera` plugin is registered in Gradle files, alongside Geolocation.
2. No code changes needed in `nativeCamera.ts` or `DriverAppSOS.tsx` -- they already handle the Camera plugin correctly with web fallback. The issue is purely native registration.

---

## Part B: Redesign Driver Map (Bolt-Style Navigation)

**Problem:** The current driver dashboard map (`DriverAppDashboard.tsx`) is a basic Google Map with small dot markers. Drivers find it hard to follow. The Bolt driver app has a cleaner, more navigation-focused experience.

**Changes to `DriverAppDashboard.tsx`:**
1. **Auto-rotate map to heading** -- when the driver is moving, tilt the map (45 degrees) and rotate it to match the driver's heading, like a real navigation app.
2. **Larger, directional driver marker** -- replace the small blue dot with a car/arrow icon that rotates with heading.
3. **Bottom card for active task** -- instead of a small floating button, show a Bolt-style bottom card with task title, ETA, distance, and a "Navigate" button that opens the in-app route or Google Maps.
4. **Cleaner map styling** -- remove clutter, use a simplified map style with muted colors so the route stands out.
5. **Auto-zoom to show route** -- when a task is active, fit the map to show both the driver and the dropoff point.

**Changes to `DriverLocationMarker.tsx`:**
1. Replace the pulsing dot with a directional car/arrow SVG marker that rotates based on heading.

**Changes to `TaskNavigationMap.tsx`:**
1. Add turn-by-turn info strip at the top (distance to next turn, street name) using Google Directions API steps data.
2. Auto-recenter on driver position as they move.
3. Add arrival detection -- when within 50m of dropoff, show "You've arrived" prompt.

---

## Part C: Full End-to-End Testing Checklist

Below is every component and feature to test, organized by app area.

### Landing / Public Pages (Web)
| # | Test | How to verify |
|---|------|--------------|
| 1 | Landing page loads | Visit `/` -- Hero, Features, Pricing, Testimonials render |
| 2 | Auth pages | `/auth/login`, `/auth/signup`, `/auth/forgot` load correctly |
| 3 | Legal pages | `/privacy`, `/terms`, `/delete-account` render content |
| 4 | Public share link | `/share/:token` loads map for a valid temp-share token |

### Admin Dashboard (Web, requires login)
| # | Test | How to verify |
|---|------|--------------|
| 5 | Dashboard loads | `/dashboard` shows map, driver list, device list |
| 6 | Live driver map | Connected drivers appear on map with real-time position |
| 7 | Add device | `/devices/new` -- create a device, verify it appears in list |
| 8 | Driver details | Click a driver on map -- details panel opens with trail, status |
| 9 | Create task | `/admin/tasks/new` -- create task with pickup/dropoff, assign to driver |
| 10 | Task list | `/admin/tasks` -- shows all tasks with status filters |
| 11 | SOS incidents | `/admin/sos` -- shows SOS events, detail drawer with photo evidence |
| 12 | Fleet analytics | `/analytics` -- charts and stats load |
| 13 | Geofences | `/geofences` -- create/view geofence polygons on map |
| 14 | Trips | `/trips` -- trip history loads |
| 15 | Temp tracking | `/temp-tracking` -- create shareable tracking link |
| 16 | Settings | `/settings` -- profile, subscription, connection codes visible |
| 17 | Payment flow | Pricing page -> checkout -> subscription activates |
| 18 | Driver management | `/admin/drivers` -- list, pause, remove drivers |
| 19 | Location simulator | `/admin/simulator` -- simulate driver location updates |

### Driver App (Mobile, code-based auth)
| # | Test | How to verify |
|---|------|--------------|
| 20 | Connect screen | `/app/connect` -- enter name + code, connects successfully |
| 21 | Location permission | LocationBlocker appears, "Enable Location" triggers native dialog (Android) |
| 22 | Dashboard map | `/app/dashboard` -- map shows driver position, tracking status, GPS quality |
| 23 | On Duty tracking | Location updates appear on admin dashboard in real-time |
| 24 | Task list | `/app/tasks` -- assigned tasks appear, can navigate to dropoff |
| 25 | Task navigation | Tap navigate icon -- route renders on map with ETA/distance |
| 26 | Complete task | `/app/tasks/:id/complete` -- take photo, add notes, submit |
| 27 | Camera capture (Android) | "Take photo" opens native camera, photo appears as preview |
| 28 | Gallery select (Android) | "Add photo/video" opens gallery picker |
| 29 | SOS trigger | `/app/sos` -- hold button 3 sec, SOS event created, appears on admin |
| 30 | SOS photo evidence | Capture photo during SOS, verify it uploads and shows on admin detail |
| 31 | Settings | `/app/settings` -- shows driver name, connection status, disconnect option |
| 32 | Background tracking | Minimize app, verify admin still receives location updates |
| 33 | Offline queue | Turn off network, trigger location updates, reconnect -- updates sync |
| 34 | Trail polyline | Drive around, blue trail line appears on driver map |
| 35 | Heartbeat | Driver stays "Active" on admin even without movement |

### Android-Specific Tests
| # | Test | How to verify |
|---|------|--------------|
| 36 | Native permission dialog | Logcat shows NO "plugin not implemented" errors |
| 37 | Camera plugin registered | Post-sync script reports `[OK] Camera plugin found` |
| 38 | App loads from local assets | Logcat shows `https://localhost` (not a remote URL) |
| 39 | Battery reporting | Battery level shows on admin dashboard for driver |
| 40 | App survives backgrounding | Return to app after 5 min, map and tracking resume |

### Cross-System Integration Tests
| # | Test | How to verify |
|---|------|--------------|
| 41 | Admin creates task -> driver sees it | Create task on web, verify it appears on driver task list within 30s |
| 42 | Driver completes task -> admin sees update | Complete task with photo, verify admin task list shows "completed" with proof |
| 43 | Driver triggers SOS -> admin gets alert | Trigger SOS on driver app, verify admin SOS panel shows incident with location |
| 44 | Geofence entry/exit | Driver enters a geofenced area, admin receives alert |
| 45 | Temp share link | Admin creates share link, open in incognito browser -- driver position visible |

---

## Implementation Order

1. **Update post-sync scripts** to verify Camera plugin registration (quick fix)
2. **Redesign driver marker** with directional car icon
3. **Add Bolt-style bottom task card** to driver dashboard
4. **Add map auto-rotation** based on heading
5. **Enhance TaskNavigationMap** with turn-by-turn info and arrival detection
6. **Test everything** using the checklist above

---

## Technical Details

- The `@capacitor/camera` package (v7.0.3) is already in `package.json` -- no new installs needed
- Map tilt/rotation uses `google.maps.Map.setTilt(45)` and `setHeading(driverHeading)` -- requires `mapId` for WebGL rendering
- The Bolt-style bottom card will be a new component `ActiveTaskCard.tsx` rendered absolutely at the bottom of the dashboard
- Driver marker rotation uses CSS `transform: rotate(${heading}deg)` on the AdvancedMarker child element
- Arrival detection uses the existing `calculateDistance` pattern from `DriverAppCompleteTask.tsx`

