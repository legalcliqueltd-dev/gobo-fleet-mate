# Stations & visit receipts — build checklist

**Goal (owner's words):** a driver must physically pass through specific marked
points — dump sites, receptacles, a school gate — and leave proof. The manager
marks those points on the map, and can later tap any point to see who came,
when, how often, which days were missed, and the photo that proves it.

**Status:** schema written + **all UI built and compiling**. Awaiting the DB
migration run (Step 0) — until then the screens load but every query fails,
which the Stations screen reports as "Has the database migration been run?".

---

## Decisions locked (owner, 2026-08-13)

| Decision | Choice |
| --- | --- |
| Database changes | SQL written to the repo; **owner runs it**, nothing auto-applied |
| Arrival rule | **75 m radius + 60 s dwell**, both editable per station |
| Visit states | Arrival logged always; photo **completes** it. "Present, no receipt" stays visible |
| Anti-fraud | **Camera-only photos** (gallery upload blocked) |

The 5 m radius originally requested was rejected on accuracy grounds: phone GPS
lands within 5-20 m at best, worse between buildings, so a 5 m rule would show
missed visits for drivers who genuinely attended. The dwell requirement — not a
tight radius — is what distinguishes attending from driving past.

---

## Step 0 — run the migration (BLOCKING, owner)

`supabase/migrations/20260813090000_stations_and_visits.sql`

Paste into Supabase → SQL Editor → Run, on project `invbnyxieoyohahqhbir`.
Safe to re-run. Creates:

- `stations` — the marked points (name, kind, colour, lat/lng, radius, dwell,
  recurrence, optional time window, requires_photo)
- `station_assignments` — narrows a station to specific drivers (none = all)
- `station_visits` — one row per driver per station per day, holding both the
  arrival facts and the receipt fields
- RLS policies, indexes, and the public `station-receipts` storage bucket

Nothing below works until this is run.

---

## Step 1 — admin: mark stations on the map ✅

- [x] `AdminAppStations.tsx` — list with kind glyph, name, schedule, radius
- [x] Tap-to-place on the map; station rings drawn at their true radius
- [x] `StationEditorSheet.tsx` — name, kind (7 types), radius slider, dwell
      slider, requires_photo toggle, recurrence (daily / weekly + weekday
      picker / once / none), driver instructions, active/paused
- [x] Delete with confirm, warning that history goes with it
- [x] New "Stations" tab in the manager tab bar

## Step 2 — driver: see stations and leave receipts ✅

- [x] Station rings + labels on the driver map, in the manager's colour
- [x] `StationsCard.tsx` — today's stops, collapsible, outstanding count
- [x] `useStationWatcher.ts` — dwell-gated arrival detection, upserts one visit
      per station/driver/day; retries on failure rather than losing the visit
- [x] Camera-only receipt (`capturePhoto('camera')`, gallery never offered),
      uploaded to `station-receipts`, visit patched to `completed`
- [x] Card states read plainly: Not yet / Arrived — receipt needed / Done

## Step 3 — history (the receipt trail) ✅

- [x] `AdminAppStationDetail.tsx` — 14-day attendance strip (receipt / arrived
      only / missed), visit log with time, dwell, distance, flag reason
- [x] Full-screen receipt viewer showing submitted-at and distance from station
- [x] Web dashboard parity — `src/pages/Stations.tsx` at `/stations`, linked
      from the main nav. List + map + selected station's attendance strip and
      visit log side by side, sharing the same editor as the app
- [ ] Per-driver day-by-day route replay (deferred — see below)

## Step 4 — keep it uncluttered ✅ (partial)

- [x] Completed stations fade back; only outstanding ones stay saturated
- [x] Setup map shows stations only — no live vehicles mixed in
- [x] One panel per tap; sheets never stack
- [ ] Marker clustering at low zoom (deferred — only matters past ~20 stations)

## Step 5 — accountability ✅

- [x] `trackingGaps.ts` — gap detection from `driver_location_history`
- [x] Driver detail shows 24 h coverage %, an "open gap" alert when a phone is
      dark right now, and the recent gap spans with start/end times
- [x] Vehicle-motion check in `useStationWatcher` — flags an arrival whose
      approach never exceeded walking pace (8 km/h)

---

## Deferred (offered, not selected)

These were presented and left out of this round. Each is independently
addable later:

- **Server-side time + GPS stamping of receipts** — the DB already records
  `created_at` server-side, so timestamps are trustworthy for free; what is
  deferred is cross-checking the *claimed* photo coordinates against the
  server's view before accepting them.
- **Vehicle-motion check** — Android activity recognition (in-vehicle vs
  on-foot) plus speed profile, to flag "parked and walked over" arrivals.
- **Tracking-gap detection** — surface phone-off / battery-dead / force-quit
  gaps on the history timeline so silence is visible rather than invisible.

### Honest limits worth knowing

- **A phone cannot prove the vehicle arrived.** Only the phone is tracked. The
  sustained-speed profile makes walking or a motorbike detectable, but proving
  the truck came needs vehicle-side hardware (OBD dongle or a Bluetooth beacon
  in the cab that the app must see). Everything else is inference.
- **A dead phone records nothing.** Offline is solved — fixes and visits queue
  locally and sync on reconnect. Powered-off is not, and cannot be. The honest
  mitigation is to make the gap loud (deferred item above) so an absence is
  something the manager sees rather than something that looks like a quiet day.
