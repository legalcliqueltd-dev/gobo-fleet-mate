# Offline tracking: what was wrong and what was done

Written for: the owner. Plain language, no code.

Testers reported two things — tracking stopped when they left the app, and
the offline queue "did not queue fast". They were not one bug. There were
**three separate faults**, each enough on its own to produce what was seen.

---

## 1. Android was tracking through the browser window

The app is a web app inside a native shell. Tracking used a location watcher
that delivers into that browser window — and **Android freezes browser
JavaScript within minutes of the app being backgrounded.** The backup timer
froze with it.

So a driver got one fix when he pressed Start, **nothing at all for the whole
journey**, and another fix when he reopened the app. Two points, joined by a
straight line across the city. That is exactly what the manager saw.

**Done:** tracking moved onto a real Android *foreground service*. The
operating system keeps delivering location while the app is away, because the
service is not the browser window. The permanent notification in the shade is
not decoration — on Android it is what *buys* the background permission, and
it is also the honest disclosure to the driver that he is being tracked.

Recording is every 15 metres of movement, and a cached fix is never accepted:
a stale point plotted as current is worse than a gap, because it reads as the
driver being somewhere he is not.

## 2. The queue was only ever fed by failures

The offline queue was written to in exactly one place: the error handler of a
failed upload. Positions that arrived between uploads were **thrown away**.

That sounds survivable until you consider what happens with no signal: the
upload does not fail quickly, it *hangs*, sometimes for minutes, before giving
up. So a driver could be offline for an hour and come back with two or three
points. The queue was not slow. It was barely being written to.

**Done:** the queue is now the system of record. Every 30 seconds a point is
written to the phone's own storage **first, and unconditionally**, whatever
the network is doing. Uploading is an optimisation layered on top, and a
successful upload deletes its own copy so nothing is recorded twice.

## 3. The queue emptied on a timer that was also frozen

Uploading the backlog was driven by a repeating timer — and the same Android
freeze that killed the tracking killed the timer. Signal would come back, the
phone would be online, and **nothing would upload** until the driver happened
to open the app again. To the manager, he simply stayed missing.

**Done:** the backlog now also uploads when the phone **regains network**,
when the **app resumes**, and when the **screen becomes visible**. Those
events are delivered even when timers are not, and they are precisely the
moments that coincide with getting signal back.

---

## Smaller fixes in the same pass

- **A point can no longer be sent twice.** A fix is queued before upload is
  attempted, so there is a window where the queue holds something already in
  flight. That window is now guarded.
- **The stuck "1 queued" badge.** Drivers who were perfectly online saw a
  permanent "1 queued". The count was simply never refreshed on the path where
  the queue turned out to be empty. The queue was fine; only the number lied.
- **Battery was always 100%** on Android. The reading came from a part of the
  system that only exists on iOS. It reads the real battery now.
- **Silent permission failures.** If location permission is withdrawn, tracking
  stops but the app still looks on duty. It now says so, loudly.

## What the driver can see now

Tapping **On duty** on the home screen opens four readings:

| | |
| --- | --- |
| **Sync** | Live · No signal · Catching up · Stopped |
| **Saved here** | how many fixes are waiting on the phone |
| **GPS** | fix quality in metres |
| **Battery** | the real percentage |

Plus one line in his own words: *"Anything that fails is kept on the phone and
sent when signal returns."* He can go off duty from the same panel.

---

## Still open — needs your decision

**Duplicate protection on the server.** The upload endpoint inserts trail
points with no uniqueness rule. That is why there is still no timeout on the
live upload: a request that hangs, is abandoned, and then *succeeds* anyway
would write the same fix twice. The fix is a unique index on driver + recorded
time, with duplicates ignored on insert. **This is a database change and needs
your go-ahead.**

**The live pin lags the trail.** Uploading a backlog fills in history but does
not move the driver's current pin on your map, so after a drain the pin can
sit behind the trail. Same database conversation.

## The test only you can run

Everything above is verified in code and on an emulator. The emulator cannot
prove it, because it has one fixed coordinate and no real radio.

The real test: **go on duty, put the phone in airplane mode, drive for twenty
minutes, then turn signal back on.** Expected result — a continuous trail for
the whole twenty minutes appears within a minute of reconnecting, with no gap
and no duplicated points. Leave the app backgrounded for part of it, and lock
the screen for part of it.
