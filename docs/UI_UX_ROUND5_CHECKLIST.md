# UI/UX Round 5 — Checklist (2026-07-09, APPROVED)

Rules carried over: **no backend/Supabase schema changes**; deletes use existing
tables/actions the UI already performs one-by-one, just batched.
Status legend: [ ] pending · [x] done

## 1. Task Management page — organize + bulk clear
File: `src/pages/admin/TaskList.tsx`
- [x] Reorganize with the frontend-design system so states are findable at a glance:
      clearer column headers (count chips, status color coding), consistent card
      anatomy, tighter vertical rhythm; "Completed" column visually calmer
      (dimmed) so active work pops. Newest first in every column.
- [x] Add a **"Clear completed"** button (header, next to Export): deletes ALL
      completed/failed tasks and their reports in one action, behind a styled
      ConfirmDialog stating the count ("Delete 12 completed tasks? This cannot
      be undone."). Pending/in-progress tasks are NEVER touched.
      ✓ OWNER CONFIRMED (2026-07-09): completed-only.

## 2. SOS Incidents — bulk clear resolved
File: `src/pages/ops/Incidents.tsx`
- [x] Add **"Clear resolved"** button on the Resolved section header: deletes all
      resolved/cancelled incidents in one action behind a ConfirmDialog with the
      count. Active (open/acknowledged) incidents are NEVER touched.
      (Uses the same per-row delete the page already has, batched.)

## 3. SOS Incidents — one click shows it on the map
File: `src/pages/ops/Incidents.tsx`
- [x] Diagnose why the first click doesn't pan (likely: `selectAndZoom` pans via
      a ref that isn't ready, or the pan only fires when selection *changes*, so
      the first click selects without panning). Fix so a SINGLE click on a list
      row always: selects → pans/zooms the map to the incident → opens the detail
      panel.
- [x] Highlight the selected incident marker: enlarge + ring/pulse so the eye
      lands on it immediately. Non-technical users should never need a second click.

## 4. Dashboard map — open on the latest vehicle
File: `src/components/map/LiveDriverMap.tsx`
- [x] Today the one-time auto-fit frames ALL markers (including stale/far ones),
      which reads as "a random place". Change the initial view to: center + zoom 15
      on the **most recently updated driver** (fallback: most recent device fix).
      No further automatic movement afterwards (snap-back stays dead).
- [x] "Fit all" button remains the explicit way to frame the whole fleet.

## 5. Driver app map — more alive, clearer dark mode
Files: `src/components/map/leaflet/LeafletMap.tsx` (+ dashboard usage)
- [x] Dark theme is too dim (CARTO Dark Matter): brighten via tile CSS filter
      (brightness/contrast lift) so roads and labels are clearly readable at night
      without blinding.
- [x] Make the map feel live: pulsing ring on the driver marker while tracking,
      accuracy circle around the position, more vivid trail polyline, and the
      richer CARTO Voyager palette for light mode. No new dependencies, keyless
      tiles only.
- [x] Requires driver-native rebuild + `cap sync` + APK at the end.

## 6. Verification
- [x] `npm run build` clean; screenshots: tasks page, incidents (click-to-show +
      highlight), dashboard initial view.
- [x] Driver app: rebuild bundle → sync (post-sync script!) → assembleDebug →
      plugins.json guard still green.
- [ ] Tick items here; owner confirms on production + device.
