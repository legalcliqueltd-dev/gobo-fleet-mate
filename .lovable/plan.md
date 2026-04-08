

## Plan

### Task 1: Rename app from "gobo-fleet-track" to "FleetTrackMate Driver"

There is one reference to `gobo-fleet-mate.lovable.app` in `supabase/functions/create-checkout/index.ts` (line 102). This fallback URL should be changed to `https://fleettrackmate.com`.

The published Lovable URL (`gobo-fleet-mate.lovable.app`) is a project setting outside the codebase — but the code fallback can be fixed.

**Change:**
- `supabase/functions/create-checkout/index.ts` line 102: replace `gobo-fleet-mate.lovable.app` with `fleettrackmate.com`

### Task 2: Fix zoomed/overflowing layout on the driver dashboard

The driver dashboard map creates scrollbars because:
- The outer wrapper uses `minHeight: 'calc(100vh - 140px)'` (line 419) and the map uses `minHeight: 'calc(100vh - 200px)'` (line 422), which can exceed the available space inside `DriverAppLayout` (which already has a header + bottom nav eating ~140px).
- The `<main>` in `DriverAppLayout` uses `overflow-auto` but the content overflows beyond the viewport.

**Fix:**
1. In `DriverAppLayout.tsx`: change `<main>` from `overflow-auto` to `overflow-hidden` (the map should fill, not scroll).
2. In `DriverAppDashboard.tsx` line 419: remove the `style={{ minHeight: ... }}` and use `h-full` only — let flexbox handle sizing.
3. In `DriverAppDashboard.tsx` line 422: change the map container style to `{ width: '100%', height: '100%' }` — remove the `minHeight`.
4. In `index.html` line 5: add `viewport-fit=cover` to the viewport meta and ensure `maximum-scale=1.0, user-scalable=no` for the native app context to prevent pinch-zoom causing layout overflow.

### Technical Details

- The root cause is competing `min-height` values that push content taller than the viewport, triggering scrollbars.
- Removing explicit `minHeight` styles and relying on flexbox (`flex-1` + `h-full`) will let the map fill exactly the available space.
- Setting `user-scalable=no` on viewport prevents accidental pinch-zoom on the native app (standard for mobile apps).

