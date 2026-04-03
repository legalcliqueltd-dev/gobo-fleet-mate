

# Redesign Admin Map Driver Info Popup

## What Changes

Replace the Google Maps `InfoWindow` (which adds its own white border, close button, and speech-bubble tail) with a custom `OverlayView`-based popup positioned above the clicked marker. This gives full control over styling and click-outside-to-dismiss behavior.

## Current Problem
- The `DriverCard` component renders inside Google's default `InfoWindow`, which wraps it in a white container with padding and a close "X" — clashing with the dark card design
- No click-outside-to-dismiss behavior on the map itself

## Implementation

### 1. Replace InfoWindow with OverlayView in `LiveDriverMap.tsx`
- Remove the `InfoWindow` import and usage (lines 726-738)
- Use `OverlayView` instead, positioned at the driver's coordinates with a pixel offset above the marker
- The `DriverCard` renders directly inside the overlay — no Google wrapper styling

### 2. Add map click handler to dismiss
- Add `onClick` handler to the `GoogleMap` component that sets `openInfoWindowId` to `null`
- The marker click already toggles the info window open/closed, so clicking a marker opens it, clicking the map (or another marker) closes it

### 3. Redesign the DriverCard component
- Add a downward-pointing triangle/arrow at the bottom of the card (CSS) to visually connect it to the marker
- Add a subtle entrance animation (fade + slide up)
- Stop click propagation on the card itself so clicking within it doesn't dismiss it
- Add a close button in the top-right corner as a secondary dismiss option

### 4. Click-outside logic
- Map click → dismiss
- Marker click → toggle (open if closed, close if open, switch if different driver)
- Card click → stays open (stopPropagation)

### Files Modified
- `src/components/map/LiveDriverMap.tsx` — replace InfoWindow with OverlayView, add map onClick handler, update DriverCard with arrow indicator and animation

