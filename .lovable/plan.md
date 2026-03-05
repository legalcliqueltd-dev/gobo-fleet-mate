

## Blur the Map When Over Device Limit

### What Changes
Instead of just showing a warning banner when the user is over the device limit, the map (`LiveDriverMap`) will be blurred with an overlay message prompting the admin to pause excess devices. The blur lifts automatically once `activeNonPausedDevices <= deviceLimit`.

### Technical Details

**File: `src/pages/Dashboard.tsx`**

Wrap the `<LiveDriverMap>` section (around line 326) with a conditional blur overlay when `isOverLimit` is true:

- Add a `relative` wrapper `div` around the map section
- When `isOverLimit`, apply `blur-md pointer-events-none` to the map and render an absolute-positioned overlay on top with:
  - A lock/warning icon
  - Text: "Pause {excessCount} device(s) to unlock the map"
  - "Upgrade to Pro" button (opens upgrade modal)
- The device cards panel (right side) remains fully interactive so the admin can pause devices
- The existing over-limit banner can remain as additional context, or be simplified since the map overlay now communicates the same message

This is purely a CSS/JSX change in `Dashboard.tsx` — no new files or hooks needed. The blur removes itself reactively because `isOverLimit` recalculates from `items` state which updates optimistically on pause/resume.

