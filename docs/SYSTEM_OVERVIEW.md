# FleetTrackMate — system overview

What exists today, how the pieces fit, and what is deliberately not finished.
Written as the single document to read before changing anything.

Last updated: 2026-10-02 · app version **2.3.1 (versionCode 8)**

---

## 1. What the product is

GPS fleet tracking sold to small fleet operators. Two faces, one business:

- **Managers pay.** The web dashboard and the manager side of the mobile app
  lock when the subscription lapses.
- **Drivers are free, forever.** The driver side never asks for money and never
  mentions a plan.

That split is not only commercial. It is what lets the iOS build rely on **App
Store guideline 3.1.3(f)** — a free companion to a paid web tool — so the native
bundle may contain no purchase surface at all.

---

## 2. One binary, two apps

The mobile app ships **both** portals behind a one-time role picker:

```
  /app            → remembered role, or the picker on first launch
  /app/driver/*   → code-based driver session, no email, no password
  /app/admin/*    → manager portal on the same Supabase identities as the web
```

- Driver screens: `src/pages/app/` (12 screens)
- Manager screens: `src/pages/app/admin/` (21 screens)
- Native entry: `src/NativeApp.tsx` — **not** `src/App.tsx`

### The build-target switch

`VITE_BUILD_TARGET=driver-native` aliases the app entry to `NativeApp.tsx`, a
slimmed tree. `App.tsx` is the full web app and is never shipped natively.

**Why it matters:** Landing, Pricing, PaymentWall, PaymentModal, LockedFeature
and the Stripe/Paystack checkout paths are not imported anywhere in the native
tree, so Rollup drops them. `scripts/verify-native-bundle.sh` fails the build if
any purchase or marketing string survives. Manager screens must therefore gate
on **data**, never on `LockedFeature` — importing it pulls PaymentWall back in
and breaks 3.1.3(f).

---

## 3. Tracking — the foundation everything else rests on

### Android

Real background location comes from
`@capacitor-community/background-geolocation`, which runs a **foreground
service**. This is not decoration:

- On Android it is what *buys* the background permission.
- It is also the honest disclosure that the driver is being tracked.
- Defining `backgroundMessage` is what enables background delivery at all.

`distanceFilter: 15` — tight enough that the drawn line follows the road, loose
enough not to log a point per second at a junction.

**The failure mode this replaced:** `Geolocation.watchPosition` delivers into the
WebView, and Android freezes WebView JS under Doze within minutes of
backgrounding. A `setInterval` backup dies the same way. The result was one fix
at the start, nothing during the journey, and another on reopening — two points
joined by a straight line.

> **Chromium freezes timers in a backgrounded WebView.** This single fact has
> caused at least four separate bugs in this codebase. Anything that must
> survive backgrounding cannot depend on `setInterval`.

### Why Transistorsoft is stripped on Android

`scripts/android-post-sync.sh` removes it from Gradle **and** from
`capacitor.plugins.json`. Not because it is iOS-only — it ships a full Android
implementation — but because **the Android module requires a paid licence for
release builds**. iOS needs no licence, so it stays there.

One bad classpath entry causes `PluginLoadException`, after which **no plugins
register at all** and the app looks broken in ways that have nothing to do with
location. Never run bare `npx cap sync android`; always follow with
`bash scripts/android-post-sync.sh`.

### The offline queue

IndexedDB store `ftm_offline_locations` (`src/utils/offlineLocationStore.ts`).

**The queue is the system of record.** Every 30 seconds a point is written to
IndexedDB first and unconditionally, whatever the network is doing. The live
send is an optimisation on top, and a successful one retires its own copy by
`syncKey` so history never receives the same fix twice. In-flight keys are held
out of the drain batch so a concurrent drain cannot double-post.

Draining fires on the **`online` event, app resume and visibility change** — not
only the 60-second timer, which freezes exactly when a driver is driving.

The `sync-trail` action inserts into `driver_location_history` using each
point's **original `recorded_at`**, so backfill lands at the times it actually
happened rather than bunched at the reconnect.

**Known gap:** `sync-trail` does *not* upsert `driver_locations`. After a drain,
history is correct but the manager's live map pin can sit at the last
pre-offline position until the next live fix. Roughly four lines to fix;
deliberately not done.

**Status: unverified on hardware.** The rewrite typechecks and builds, but no
device has been attached since it was written. Tests 3.12–3.17 in
`TEST_PLAN.md` are the ones that settle it.

---

## 4. Features

| Area | What it does | Screens |
| --- | --- | --- |
| **Fleet map** | Live vehicles as car markers coloured per driver; status ring; focus card on tap with place name, accuracy halo and four actions | `AdminAppFleet` |
| **Stations** | Manager marks points drivers must attend; 75 m radius, 60 s dwell; photo receipt as proof; recurring or one-time; per-driver assignment | `AdminAppStations`, `StationDetail`, `StationsCard` |
| **Jobs** | Assign work to a driver with a drop-off; driver completes with photo, receiver, signature | `AdminAppTasks`, `AdminAppCreateJob`, `DriverAppCompleteTask` |
| **History** | Per-driver route replay, trips, stops, blackout gaps; calendar starts at today | `AdminAppHistory`, `DriverHistoryView` |
| **Insights** | Per-driver figures, not fleet blur | `AdminAppInsights`, `AdminAppDailyReport` |
| **Alerts / SOS** | Driver panic button reaching the manager with position | `AdminAppAlerts`, `DriverAppSOS` |
| **Driver value** | Expenses/fuel log, "my proof" record, vehicle checks, problem reports | `DriverAppExpenses`, `Record`, `Checks` |
| **Codes** | Issue, revoke, reassign driver connection codes. Revoking never wipes the driver's records | `AdminAppCodes` |
| **Onboarding** | Driver tour, then a permissions carousel (location → notifications → battery → what stops tracking) | `PermissionsCarousel`, `DriverOnboarding` |

### Plans

`src/hooks/useEntitlements.ts` is the single source of truth:

```ts
canUseStations: isPro || isTrial
driverLimit:    isPro ? Infinity : 2
```

Basic sees everything except Stations and is capped at 2 drivers. Tapping
Stations on Basic shows an explainer — **ending with a website CTA, never an
in-app purchase prompt**, per 3.1.3(f).

---

## 5. Data model

24 tables. The ones that matter day to day:

| Table | Holds |
| --- | --- |
| `drivers` | one row per connected driver, keyed by `driver_id` + `admin_code` |
| `devices`, `driver_connections` | connection codes, mapped to a manager |
| `driver_locations` | current position — what the live map reads |
| `driver_location_history` | every fix, with `recorded_at` |
| `tasks`, `task_reports` | jobs and their proof of delivery |
| `stations`, `station_assignments`, `station_visits` | stations and attendance |
| `driver_expenses`, `driver_reports` | driver-side records |
| `sos_events`, `sos_position_updates` | emergencies |
| `admin_subscriptions`, `profiles` | billing and plan state |

### The `admin_code` wart — do not try to fix it

`drivers.admin_code`, `tasks.admin_code`, `stations.admin_code` and others hold
a **connection code**, not an admin's code. The name is wrong. It appears **139
times in `src/`** plus RPCs, RLS policies, two edge functions and the offline
queue payloads.

**Leave it. Do not add more.** New tables reach tenancy through a foreign key
instead.

### Unauthenticated drivers

Drivers have no Supabase auth session — they join with a code. So RLS cannot key
on `auth.uid()` for driver writes, and `SECURITY DEFINER` functions resolve a
code to its manager:

- `stations_for_code(p_code)` — the stations a driver should see
- `manager_for_code(p_code)` — the manager who issued a code

**This has bitten twice.** Both times a station was readable fleet-wide but the
write path still demanded `s.admin_code = <row>.admin_code`, so only the one
driver whose code created the station could record anything. If you add a
driver-written table, check the write policy resolves through the *manager*.

---

## 6. Edge functions

19 deployed. `connect-driver` is the busy one — driver registration,
`update-location`, `sync-trail`, task reports, status and heartbeat. Others
cover subscriptions (Stripe + Paystack), SOS dispatch, email, account deletion
and platform admin.

---

## 7. Release

### Android

```bash
npx vite build                                   # web
VITE_BUILD_TARGET=driver-native npx vite build   # native bundle
bash scripts/verify-native-bundle.sh             # must pass
bash scripts/prepare-driver-capacitor-config.sh
npx cap sync android
bash scripts/android-post-sync.sh                # never skip
cd android && ./gradlew :app:bundleRelease
```

Gradle produces an **unsigned** AAB — there is no `signingConfig` and no
keystore on the build machine, by design, so the upload key can never drift. The
owner signs in **Android Studio → Generate Signed App Bundle**, which writes to
`android/app/release/`. That file's timestamp is how you tell whether a build
was actually shipped.

Bump `versionCode` before every upload. targetSdk 36.

### iOS

`npm run cap:build:ios`, then `pod install` on macOS and archive in Xcode.
Sign in with Apple is **required** before submission because Google sign-in is
offered (guideline 4.8). In-app account deletion is routed for 5.1.1(v).

---

## 8. Current state

**Shipped to testers:** 2.3.0 (versionCode 7).

**Built, signed-and-uploaded by the owner:** not yet — 2.3.1 (versionCode 8) is
built and unsigned, waiting. Play production approval is granted but the release
has not been pushed live.

**2.3.1 contains:** the offline-queue rewrite, event-driven drains, driver-map
declutter, the "what stops your tracking" onboarding card, and the history-page
layout fix.

### Migrations

`20260922090000_station_visits_fleet_wide.sql` — **applied** 2026-09-22. Fixed
delivery receipts for every driver not on the station's original code. Because
it is pure RLS, it fixed testers on the build they already had.

**Not applied:** `20260823090000_review_account_access.sql` and
`20260831140000_fix_review_account.sql` — store-reviewer full access. Apple-
facing; a reviewer without it hits a locked manager side.

### Known gaps, deliberately

1. `sync-trail` does not upsert `driver_locations` (§3).
2. Offline queue unverified on hardware (§3).
3. **Edge-to-edge Play warnings.** targetSdk 36 means Android 15+ draws behind
   the system bars. Capacitor's default `adjustMarginsForEdgeToEdge: 'auto'` is
   padding around it. The *deprecated API* warning comes from Capacitor or a
   plugin, not from this code — `styles.xml` sets no bar colours and
   `MainActivity` is an empty `BridgeActivity`. Both are advisories, not
   blockers. `viewport-fit=cover` is set and 20 files use
   `env(safe-area-inset-*)`, so the web side is ready whenever this is tackled.
4. **UI bulk on the fleet map** — 5 simultaneous overlays, a 5-button rail, 6
   bottom tabs. Flagged against the standing minimal-but-purposeful directive;
   a declutter pass is queued behind getting 2.3.1 field data.

---

## 9. Conventions that are not obvious

- **Design system:** "Asphalt & Signal" in `src/index.css`. Barlow Semi
  Condensed / Barlow / IBM Plex Mono, with `.eyebrow` and `.telemetry` helpers.
- **UI directive:** minimal but purposeful. No explanatory prose on dashboards;
  every destination must earn its place; prefer list rows you tap into.
- **OSM/CARTO attribution must stay visible** — a licence requirement. Restyle
  it, never remove it.
- **Backend changes require explicit per-case authorisation**, on project ref
  `invbnyxieoyohahqhbir` only.
- **Tailwind trap:** `h-13` and `h-4.5` are not in the default scale.
- **Notification channels:** Android 8+ makes channel sound immutable after
  creation, so channel ids carry a `_v1` suffix.

---

## 10. Other documents

| Doc | For |
| --- | --- |
| `TEST_PLAN.md` | 14 sections of numbered tests; the field-verification source |
| `DELIVERY_CODE_SPEC.md` | Proposed delivery-code feature — **nothing built** |
| `STATIONS_CHECKLIST.md` | Stations build plan |
| `ADMIN_APP_SETUP.md` | Manager Google/Apple auth credentials setup |
| `IOS_RELEASE.md` | App Store submission specifics |
| `HANDOFF.md` | Review-account credentials and verification commands |
