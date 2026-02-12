
# Fix: Auto-Zoom Map on Incident Selection

## Problem
Clicking an incident in the left panel should automatically zoom the map to that incident's location. The existing `useEffect` (lines 110-120) has the correct `panTo`/`setZoom` logic, but it can be overridden by `loadEvents` re-fitting bounds on realtime updates, and may not trigger reliably due to the `selectedEvent?.id` dependency.

## Solution
**File: `src/pages/ops/Incidents.tsx`**

1. **Move zoom logic into the click handler directly** instead of relying on a `useEffect`. When a user clicks an incident in the left list, immediately call `mapRef.current.panTo()` and `mapRef.current.setZoom(16)` inside the `onClick`.

2. **Prevent `loadEvents` from re-fitting bounds after initial load.** The `hasFittedInitialBounds` ref already guards this, but ensure the realtime subscription callback doesn't inadvertently reset the view.

3. **Create a helper function** like `selectAndZoom(evt)` that:
   - Sets the selected event state
   - Immediately pans the map to `evt.latitude, evt.longitude`
   - Zooms to level 16
   - This avoids timing issues with `useEffect` and ensures instant response

## Technical Details

- Replace `onClick={() => setSelectedEvent(evt)}` (lines 391, 439, 510) with `onClick={() => selectAndZoom(evt)}`
- Add a `selectAndZoom` function:
  ```typescript
  const selectAndZoom = useCallback((evt: SOSEvent) => {
    setSelectedEvent(evt);
    if (mapRef.current && evt.latitude && evt.longitude) {
      mapRef.current.panTo({ lat: evt.latitude, lng: evt.longitude });
      mapRef.current.setZoom(16);
    }
  }, []);
  ```
- Keep the existing `useEffect` as a fallback for cases where `mapRef` isn't ready yet (e.g., initial auto-select on page load)
- Remove the `fitBounds` call inside `loadEvents` (lines 194-202) since `hasFittedInitialBounds` is already handled in `onLoad`

This is a small, focused change -- about 10 lines modified.
