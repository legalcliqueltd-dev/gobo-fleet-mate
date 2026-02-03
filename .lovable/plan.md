
# Driver Location Features Plan

## Overview

This plan implements two related features:
1. **Dashboard**: Ensure clicking a connected driver centers the map on their current location
2. **Driver Details Page**: Add a "Current Location" button on the map to re-center on the driver's position

---

## Feature 1: Dashboard - Click Driver to Center Map

### Current Behavior
Looking at the code, clicking on a connected driver in `DriversList.tsx` already calls `onDriverSelect?.(driver)` which triggers `handleDriverSelect` in `Dashboard.tsx` → sets `selectedDriverId` → `LiveDriverMap` receives it and should pan to that driver.

### What Needs Verification
The `LiveDriverMap` component already has logic to pan to selected driver. However, we should verify the flow is working correctly and improve the pan behavior if needed.

### Changes to `LiveDriverMap.tsx`
- Ensure the map smoothly pans to the selected driver when `selectedDriverId` changes
- Add a visual indication that the driver is focused (already has selection ring)

---

## Feature 2: Driver Details Page - "Current Location" Button

### Location
Add a button to the map overlay in `DriverLocationMap.tsx` that re-centers the map on the driver's current location.

### Button Design
```
┌─────────────────────────────────────────────────┐
│ [Driver Info Overlay - top left]                │
│                                                 │
│                    MAP                          │
│                                                 │
│                           [📍 Current] ← NEW    │
│ [Legend - bottom left]                          │
└─────────────────────────────────────────────────┘
```

### Placement
- Position: **Bottom right** corner of the map
- Style: Floating button with icon + text, matching the existing overlay style

### Behavior
When clicked:
1. Pan the map to the driver's current location
2. Set appropriate zoom level (14-15)
3. Brief visual feedback (button highlight)

---

## Files to Modify

### 1. `src/components/map/DriverLocationMap.tsx`

**Add "Current Location" Button**:
- Add a new floating button in the bottom-right corner
- Import `Crosshair` or `Target` icon from lucide-react
- Create click handler that pans map to `currentLocation`

**New code to add (around line 213-228)**:
```tsx
{/* Current Location Button - Bottom Right */}
<button
  onClick={() => {
    if (mapRef.current && currentLocation) {
      mapRef.current.panTo({ 
        lat: currentLocation.latitude, 
        lng: currentLocation.longitude 
      });
      mapRef.current.setZoom(15);
    }
  }}
  className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-card/95 backdrop-blur-sm rounded-lg px-3 py-2 border border-border shadow-lg hover:bg-primary/10 hover:border-primary/50 transition-all text-xs font-medium"
  title="Center on current location"
>
  <Crosshair className="h-3.5 w-3.5 text-primary" />
  <span>Current</span>
</button>
```

### 2. `src/components/map/LiveDriverMap.tsx` (Verification)

**Verify pan behavior**:
- Ensure `useEffect` that watches `selectedDriverId` properly pans to driver
- Confirm the pan animation is smooth

Current code at ~line 500-520 should handle this. May need minor adjustment if not working.

---

## Visual Result

### Driver Details Page Map (After Change)

```
┌──────────────────────────────────────────────────┐
│ [● John Doe] [LIVE]                              │
│                                                  │
│                                                  │
│                   [Driver Marker]                │
│                        ●                         │
│                                                  │
│                                                  │
│ [● Current] [● History]          [📍 Current] ← │
└──────────────────────────────────────────────────┘
```

The button will:
- Have a crosshair/target icon
- Say "Current" as the label
- Match the existing overlay styling (glass effect with border)
- Highlight on hover

---

## Implementation Summary

| File | Change |
|------|--------|
| `src/components/map/DriverLocationMap.tsx` | Add "Current Location" floating button (bottom-right) |
| `src/components/map/LiveDriverMap.tsx` | Verify/improve selected driver pan behavior |

---

## Technical Notes

1. **Map Reference**: Both components already have `mapRef` which provides access to `panTo()` and `setZoom()` methods

2. **Smooth Pan**: Google Maps `panTo()` already animates smoothly

3. **Button Accessibility**: Include `title` attribute for tooltip and ensure keyboard accessible

4. **Responsive**: Button should be visible on all screen sizes, positioned to not overlap with other controls
