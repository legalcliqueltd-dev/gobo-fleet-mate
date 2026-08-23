# FleetTrackMate — test plan

**Why this document exists:** almost everything built recently compiles, launches,
and has never processed a single real record. Compiling is not working. This is
the list of things that must be proven with a real account, a real phone, and a
real driver before any of it can be trusted.

Work top to bottom. The order is deliberate — later sections assume earlier ones
passed, and a failure early makes everything below it meaningless.

---

## 0. Before you start

| Need | Why |
| --- | --- |
| Three SQL migrations run | Stations, expenses and reports are dead without them |
| A manager account | Every admin screen is behind sign-in |
| A second phone with the app | The driver side cannot be faked from the manager side |
| Somewhere you can physically walk to, ~100 m away | Station arrival needs real movement |

Run these in the Supabase SQL editor if you have not already:

```
supabase/migrations/20260813090000_stations_and_visits.sql
supabase/migrations/20260821120000_driver_expenses.sql
supabase/migrations/20260822090000_driver_reports.sql
supabase/migrations/20260823090000_review_account_access.sql   # store reviewers
```

**Quick check they applied:** open the app → Stations tab. If it says "Could not
load stations. Has the database migration been run?", the SQL did not take. The
same applies to Insights → Expenses and Insights → Checks and problems.

---

## 1. Sign-in and roles

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 1.1 | Fresh install → first launch | Mode picker: "I drive" / "I manage a fleet" | ☐ |
| 1.2 | Pick manager → sign in with email | Lands on the fleet map | ☐ |
| 1.3 | Force-quit and reopen | Goes straight to the manager portal, no picker | ☐ |
| 1.4 | Sign in with Google | **Native account sheet**, not a browser | ☐ |
| 1.5 | Google on a phone with no Google account | Falls back to browser, still completes | ☐ |
| 1.6 | Settings → Switch mode → I drive | Reaches the driver connect screen | ☐ |
| 1.7 | On the connect screen, tap "Wrong screen? I'm a manager" | Returns to manager sign-in immediately | ☐ |

**If 1.4 opens a browser instead of the sheet:** a SHA-1 is missing. Check all
three are registered (debug, upload, Play app-signing).

**If you see "Access blocked":** the OAuth consent screen is still in Testing.

---

## 2. Onboarding a driver

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 2.1 | Fleet tab → ＋ → name a driver → create | A code appears, large and readable | ☐ |
| 2.2 | Tap Share | Native share sheet with the code in the message | ☐ |
| 2.3 | On phone 2: "I drive" → enter that code + a name | Connects successfully | ☐ |
| 2.4 | Back on the manager map | That driver appears within ~30 s | ☐ |

---

## 3. Live tracking — the foundation

Everything else depends on this. Do not skip it.

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 3.1 | Driver goes On Duty | **Persistent notification appears** | ☐ |
| 3.2 | Manager map | Driver shows as Moving/Parked with a recent time | ☐ |
| 3.3 | **Press Home, leave the app 10+ minutes** | Manager map **keeps updating** | ☐ |
| 3.4 | Walk/drive 200 m while backgrounded | Position follows on the manager map | ☐ |
| 3.5 | Airplane mode 5 min, then restore | Queued points flush; no gap in history | ☐ |
| 3.6 | Driver battery percentage | Matches the phone's real battery | ☐ |

**3.3 is the single most important test in this document.** If tracking dies when
backgrounded, nothing built on top of it means anything.

---

## 4. Stations and receipts

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 4.1 | Stations tab → tap map → name → Create | Saves; appears in the list | ☐ |
| 4.2 | The placement map | Opens in **satellite** by default; toggles to roads | ☐ |
| 4.3 | Search an address in the editor | Pin moves there; drag adjusts it | ☐ |
| 4.4 | Set "Who must visit" → Only some → pick driver A | Saves | ☐ |
| 4.5 | On driver B's phone | Station does **not** appear | ☐ |
| 4.6 | On driver A's phone | Station appears with its type glyph | ☐ |
| 4.7 | Zoom the manager map out past city level | Markers shrink to dots, roads stay readable | ☐ |
| 4.8 | Driver A walks into the radius, **stays 60 s** | "You are at X" chip + notification with custom sound | ☐ |
| 4.9 | Manager map | That station turns **amber** (arrived, no receipt) | ☐ |
| 4.10 | Driver taps Receipt | **Camera opens directly — no gallery option** | ☐ |
| 4.11 | Submit the photo | Station turns **green** on the manager map | ☐ |
| 4.12 | Manager: tap the station | 14-day strip; today green; photo visible | ☐ |
| 4.13 | Drive **past** the station without stopping | **No** visit recorded | ☐ |

**4.10 matters:** a gallery option here would let an old photo be resubmitted as
today's proof. Expenses deliberately allow gallery; stations must not.

**4.13 is what the 60-second dwell is for.** If passing by registers a visit, the
proof is worthless.

---

## 5. Jobs

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 5.1 | Jobs → Assign job | Driver list, title, address search, map | ☐ |
| 5.2 | Type an address | Suggestions appear and set coordinates | ☐ |
| 5.3 | Tap the map instead | Pin drops; address fills in | ☐ |
| 5.4 | Send the job | Appears on the driver's phone | ☐ |
| 5.5 | Manager's Jobs list | Shows driver name + progress bar | ☐ |
| 5.6 | Driver completes it | Progress reaches Delivered | ☐ |
| 5.7 | Clear completed | Only completed go; failed are kept | ☐ |

---

## 6. Alerts

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 6.1 | Driver sends SOS | Appears on the manager's Alerts within seconds | ☐ |
| 6.2 | Tap "Show on map" | Sheet slides up; map **inside the app** | ☐ |
| 6.3 | Stations on that sheet | Visible, so distance to the round is judgeable | ☐ |
| 6.4 | Resolve it | Moves to the resolved section | ☐ |

---

## 7. Expenses — the driver's own feature

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 7.1 | Driver → Money tab | Month total, all zeros initially | ☐ |
| 7.2 | Log an expense → Fuel → amount | **Numeric keypad**, not full keyboard | ☐ |
| 7.3 | Take a photo | Camera opens; preview shows | ☐ |
| 7.4 | **Upload from gallery** | Gallery opens — allowed here, unlike stations | ☐ |
| 7.5 | Save with no photo at all | Accepted | ☐ |
| 7.6 | Manager → Insights → Expenses | Entry appears under "Waiting" | ☐ |
| 7.7 | Approve it | Driver's app shows **Approved** | ☐ |
| 7.8 | Driver tries to edit an approved entry | Blocked (it is now a record) | ☐ |

---

## 8. Vehicle checks and problems

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 8.1 | Driver → Settings → Vehicle check | Six-item checklist | ☐ |
| 8.2 | Try to send with items unmarked | Refused, with a clear message | ☐ |
| 8.3 | Mark all Fine, send | Saved | ☐ |
| 8.4 | Mark Tyres as Problem, add a photo, send | Saved with the fault | ☐ |
| 8.5 | Manager → Insights → Checks and problems | Fault sorts **above** the clean check | ☐ |
| 8.6 | Report a problem → Road blocked → photo | Sends with location | ☐ |
| 8.7 | Manager taps "Where it was raised" | In-app sheet at that point — app never left | ☐ |
| 8.8 | Mark resolved | Moves down the list | ☐ |
| 8.9 | Driver → Settings | "Yours" section is visually distinct (tinted, own heading) | ☐ |
| 8.10 | Settings → My record | His stops, jobs, distance, days and receipt log | ☐ |
| 8.11 | Driver tutorial | Includes Money, Stations/proof and Vehicle check slides | ☐ |

---

## 9. History and insights

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 9.1 | Driver detail → History | Today's route drawn | ☐ |
| 9.2 | The timeline | Trips and stops as separate rows, not one line | ☐ |
| 9.3 | Tap a trip | Map frames just that segment | ☐ |
| 9.4 | After test 3.5 (airplane mode) | A **dashed amber** gap, labelled "No signal" | ☐ |
| 9.5 | Insights | Distance/speeds are plausible, not zero, not absurd | ☐ |
| 9.6 | "By driver" list | Totals equal the sum of the rows | ☐ |
| 9.7 | Driver → Settings → My record | His own stops, distance, and receipts | ☐ |

**9.5:** a stationary phone should show ~0 km, not a slow creep. Creep means the
noise filtering is not working.

---

## 10. Codes: revoke, replace, delete

The rule under test is **revoke never erases**. A driver's records are evidence
for him as much as for you, so removing access must not be able to delete them.

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 10.1 | Fleet map → key icon (or Settings → Drivers & codes) | Every code listed, grouped "Ready to hand out" / "In use" | ☐ |
| 10.2 | An unclaimed code | Shown **large and readable**, with Share | ☐ |
| 10.3 | A claimed code | Shown as ●●●●●● until you tap the eye | ☐ |
| 10.4 | Revoke an active driver | Confirm dialog states records are kept | ☐ |
| 10.5 | After revoking | Driver disappears from the live map | ☐ |
| 10.6 | **On the driver's phone, within ~2 min or on reopening** | Logged out, told to ask for a new code | ☐ |
| 10.7 | Driver tries the **old** code | Rejected — it was rotated on revoke | ☐ |
| 10.8 | Manager → that driver's history / receipts / expenses | **All still there** | ☐ |
| 10.9 | Give the new code to a driver | Joins normally onto the same vehicle | ☐ |
| 10.10 | "New code" on an active driver | Old code dies; that driver is logged out | ☐ |
| 10.11 | Delete on an unclaimed code | Allowed | ☐ |
| 10.12 | Delete on a code a driver has used | **Not offered at all** | ☐ |

**10.6 and 10.8 are the two that matter.** If the driver keeps transmitting after
revocation, the button is a lie. If his records vanish, the evidence trail can be
erased by firing someone.

---

## 11. In-app maps and today's summary

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 11.1 | Alerts → Show on map | Map **slides up from the bottom**, app never left | ☐ |
| 11.2 | On that sheet | Stations and live vehicles visible around the incident | ☐ |
| 11.3 | Drag the sheet down / tap outside | Dismisses | ☐ |
| 11.4 | Expand button | Grows to near full screen, map re-centres | ☐ |
| 11.5 | Checks & problems → Where it was raised | Same sheet | ☐ |
| 11.6 | Driver detail → On map | Same sheet, centred on the driver | ☐ |
| 11.7 | Anywhere in the manager app | **Nothing** jumps out to the Google Maps app | ☐ |
| 11.8 | Insights → Today's summary | Stations, jobs, alerts, spend for today | ☐ |
| 11.9 | Share today's summary | Share sheet with readable plain text | ☐ |
| 11.10 | Station markers | **Pin-shaped**, glyph inside, tip on the exact point | ☐ |
| 11.11 | Zoom out past city level | Pins become dots; roads stay readable | ☐ |
| 11.12 | Driver history date strip | Starts at **Today**, scrolls back; "Pick" opens a date picker | ☐ |

**11.7:** the driver's own turn-by-turn *does* still open Google Maps, and that is
intended — it is real navigation, not a glance.

---

## 12. Plans: free, Basic, Pro

The model: **drivers are free forever**; only the manager side is gated.

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 12.1 | Driver app on an expired manager's fleet | Fully working — tracking, stations, receipts, expenses | ☐ |
| 12.2 | Manager on trial | Everything works, stations included | ☐ |
| 12.3 | Manager on **Basic**, open Stations | Explainer: what stations are and how they work | ☐ |
| 12.4 | That explainer **in the app** | Ends with plain text, **no Subscribe button or link** | ☐ |
| 12.5 | That explainer **on the website** | Ends with a working "See plans" button | ☐ |
| 12.6 | Basic manager's fleet map | No station pins drawn | ☐ |
| 12.7 | Basic manager, add a 3rd driver | Blocked, with the two-driver cap explained | ☐ |
| 12.8 | Pro manager | Stations work; driver count unlimited | ☐ |
| 12.9 | **Expired** manager, fleet map | Still loads — vehicles visible | ☐ |
| 12.10 | Expired manager: Jobs, Insights, Expenses, History, Today | Each shows a lock naming the feature | ☐ |
| 12.11 | Expired manager: Alerts | **Still works** — safety is never gated | ☐ |
| 12.12 | Stations screen → "Show on the fleet map" off | Pins disappear from the fleet map | ☐ |
| 12.13 | Sign in as the review account (akeduye@gmail.com) | Everything unlocked, Stations included | ☐ |

**12.4 is a store-compliance test, not a preference.** A purchase button inside
the app breaks App Store guideline 3.1.3(f) and Play's billing policy. The app
teaches and stops; the website sells.

**12.11:** an SOS from a driver in trouble must never be hidden behind a lapsed
card.

---

## 13. Website parity

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 14.1 | Log in on the website | Same account as the app | ☐ |
| 13.2 | Stations page | Same stations, same colours | ☐ |
| 13.3 | Dashboard map | Stations drawn with completion state | ☐ |
| 13.4 | Driver → history | Same trips/stops as the app | ☐ |

---

## 14. Release readiness

| # | Test | Expected | Pass |
| --- | --- | --- | --- |
| 14.1 | App name on the home screen | **FleetTrackMate** (not "-Driver") | ☐ |
| 14.2 | Signed AAB version | versionCode **5**, versionName 2.2.1 | ☐ |
| 14.3 | Fresh install → first manager login | Tutorial shows **once**, then never again | ☐ |
| 14.4 | Settings → How to use | Tutorial opens on demand | ☐ |
| 14.5 | Dark mode across every screen | No unreadable text, no white flashes | ☐ |
| 14.6 | Play Console upload | Accepted; no targetSdk warning | ☐ |

---

## Known limits — not bugs, do not raise them

- **Notifications do not arrive when the app is fully closed.** Local
  notifications only fire from a running app. Waking a closed app needs Firebase
  Cloud Messaging (project, `google-services.json`, server key, edge function).
- **A dead phone records nothing.** Offline is handled — points queue and flush.
  Powered-off cannot be, by anyone. The gap is made visible instead.
- **A phone cannot prove the vehicle arrived.** Speed profiles flag a walking
  approach, but proving the truck came needs hardware in the cab.
- **Sign in with Apple is iOS-only** and hidden elsewhere; it is required before
  any App Store submission because Google sign-in is offered.
- **Station arrival needs ~75 m and 60 s.** Tighter would miss real visits: phone
  GPS is accurate to 5–20 m at best, worse between buildings.

---

## Reporting a failure

Include: which numbered test, what you expected, what happened, which phone, and
whether the app was foreground/background/closed. For anything tracking-related,
a logcat capture around the failure is worth more than a description.
