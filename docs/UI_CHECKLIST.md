# TrackMate — UI & design checklist

Written for: the owner. Updated 2026-10-18.

Three phases. **Driver app is done.** Manager app and website are next.

---

## Phase 1 — Driver app ✅ done

### Brand
- [x] Navy / neon / amber palette, one green everywhere
- [x] Red removed from everything except SOS — including map pins, which were
      the last holdouts
- [x] `destructive` token moved to amber; a separate `sos` token carries the
      only red
- [x] Repeating-mark texture on the sign-in, role-picker and connect screens
- [x] Navy slab headers on Jobs and Stations, carrying the count
- [x] Station colour picker cut from eight free hues to four brand ones, with
      a clamp so stations saved before the rebrand render navy, not red

### Structure
- [x] Nav is three destinations + More. SOS out of the bar, into the header
- [x] Home is a duty panel, a collapsible map strip and one list of stops
- [x] Stations is its own screen, a list not a map
- [x] Jobs and Stations rebuilt from shared parts so they read as siblings
- [x] Sync Queue panel deleted from every driver screen
- [x] **Stations had no bottom navigation at all** — it was built without the
      layout wrapper. Fixed

### On duty
- [x] No longer a link to Settings
- [x] Shows sync state, points saved on the phone, GPS quality, battery
- [x] Go off duty from the panel, behind a confirm

### Navigation map
- [x] Google/Apple Maps hand-off removed entirely
- [x] 2D / 3D toggle, remembered; 3D default
- [x] Start → camera follows; drag → releases; Re-centre → takes it back
- [x] Driver sits low on screen with the road ahead above him
- [x] Heading taken from the **route**, not the compass
- [x] Vector Map ID wired; tilt confirmed working on device
- [x] Zoom guard so a far-away stop no longer opens on a view of the ocean
- [x] One appearance always — never follows the driver's theme

### Settings
- [x] Theme control given full width, matching the manager's layout

---

## Phase 2 — Manager app (next)

- [ ] Fleet map declutter — the control rail and remaining overlays
- [ ] Swipe-through vehicle list: swipe for more vehicles, tap to view all
- [ ] Apply the navy slab header and shared card language from the driver side
- [ ] Notifications screen
- [ ] Check every screen for the leftover old-palette greys and blues
- [ ] Confirm the fleet map opens on the fleet (race fixed, needs your eyes)

## Phase 3 — Website dashboard

- [ ] Appearance pass against the new brand
- [ ] Marketing pages — type scale, palette, the texture
- [ ] Play Store listing rebrand: name, icon, screenshots *(console work, yours)*

---

## Waiting on you

| | |
| --- | --- |
| **Icons** | station · this driver · other drivers. SVG, or PNG at 3× display size |
| **Mark as outline** | single-colour, for map pins and small glyphs |
| **App icon** | 1024px export |
| **Database go-ahead** | duplicate protection on trail upload, live-pin update — see [OFFLINE_TRACKING.md](OFFLINE_TRACKING.md) |
| **Two migrations unrun** | `20260823090000_review_account_access.sql`, `20260831140000_fix_review_account.sql` |
| **Maps key restriction** | the key is public in the APK; restrict it by package + SHA-1 and by referrer |
| **Rotate** | the Google client secret and Apple reviewer password pasted in chat |

---

## What to test — driver app

Order matters: the first two are the ones a tester will actually hit.

### Tracking (the important one)
1. Go on duty. Airplane mode. **Drive 20 minutes.** Signal back on.
   Expect: unbroken trail appears within a minute, no gap, no duplicates.
2. Repeat with the app backgrounded for part of it, screen locked for part.
3. Leave it on duty for an hour of normal driving. Check the manager map
   shows a line that follows roads, not straight cuts between two points.
4. Turn location permission off mid-shift. Expect a loud warning, not silence.
5. Watch the duty panel: does "Saved here" rise with no signal and fall to
   "Nothing" when it returns?

### Navigation
6. Open a job with a drop-off → **Start**. Does the road ahead run up the
   screen? Does the map turn when you turn?
7. Drag the map away → button becomes **Re-centre** → press it.
8. 2D / 3D toggle. Close the app, reopen, open navigation — is your choice
   remembered?
9. A stop in another town: does it open on the destination, not the ocean?

### Stations and jobs
10. Two drivers, two different connection codes, same station — can both
    file receipts? *(This is the RLS fix; it needs two real phones.)*
11. Arrive at a station, wait out the dwell timer, take the receipt photo.
12. Complete a job with a delivery code; then try one without the code.

### Everything else
13. Every screen in light **and** dark. Any red that is not SOS is a bug.
14. SOS from three different screens.
15. Theme control in Settings — all three options.

### Known limits of my testing
Everything above was checked on an emulator with one fixed GPS coordinate in
California. That cannot test movement, real radios, Doze, battery, or two
phones at once. Those are yours.
