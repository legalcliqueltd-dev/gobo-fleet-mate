

# Driver App Map UI Improvements

This plan enhances the driver app's map interface with a polished, animated marker, floating status card, and improved controls for a better mobile experience.

---

## What Will Change

### Current State
- Plain blue circle marker for driver location
- Basic "Off Duty" button with no visual feedback
- Battery badge only when tracking
- No speed indicator on map
- No "center on location" button
- No map type toggle

### After Implementation
- Animated gradient marker with pulse effect when tracking
- Direction arrow showing heading
- Floating status card with speed, battery, and sync time
- Enhanced On Duty toggle with glow effect
- "Center on me" button
- Map type toggle (roadmap/satellite)

---

## Files to Create

### 1. Driver Location Marker Component
**New file: `src/components/map/DriverLocationMarker.tsx`**

A custom SVG marker component for the driver app featuring:
- Gradient fill with glow effect (green when tracking, gray when off duty)
- Animated pulse rings when "On Duty"
- Direction arrow showing heading/bearing
- Smooth position updates using existing interpolation utilities

### 2. Driver Status Card Component
**New file: `src/components/driver/DriverStatusCard.tsx`**

A compact floating card component showing:
- Current speed in km/h (from geolocation data)
- Battery level with color-coded icon (green/amber/red)
- Last sync timestamp ("Synced 5s ago")
- Tracking status indicator
- Semi-transparent glass background

---

## Files to Modify

### 3. Enhanced Dashboard
**File: `src/pages/app/DriverAppDashboard.tsx`**

Changes:
- Replace simple `Marker` with new `DriverLocationMarker`
- Add heading/bearing tracking from geolocation
- Add speed state from position updates
- Import and position `DriverStatusCard` at bottom of map
- Add "Center on me" floating button
- Add map type toggle button (roadmap/satellite)
- Enhance On Duty toggle with glow animation when active
- Track continuous location updates for speed display

### 4. CSS Animations
**File: `src/index.css`**

Add new utility classes:
- `.driver-marker-pulse` - pulse animation for active tracking
- `.driver-status-card` - glass morphism styling
- `.btn-glow-active` - glow effect for On Duty button

---

## Technical Details

### Marker Animation Logic
```text
When On Duty:
  - Marker shows green gradient
  - Outer ring pulses continuously
  - Direction arrow visible (if heading available)

When Off Duty:
  - Marker shows gray gradient
  - No pulse animation
  - No direction arrow
```

### Status Card Data Flow
```text
Geolocation API → position update
    ├── latitude/longitude → map center
    ├── speed → status card (converted to km/h)
    ├── heading → marker direction arrow
    └── timestamp → "Synced X ago" display

Battery API → batteryLevel → status card icon
```

### Map Controls Layout
```text
┌──────────────────────────────────┐
│ [On Duty ✓]           [🔋 82%]  │
│                                  │
│ [1 Task]                         │
│                                  │
│           ⬆                      │
│          (animated marker        │
│           with direction)        │
│                                  │
│                   [🎯] [🗺️]      │ ← center + map type
├──────────────────────────────────┤
│ ⚡ 45 km/h  │  🔋 82%  │ 5s ago │ ← status card
├──────────────────────────────────┤
│   Home   Tasks   SOS   Settings  │
└──────────────────────────────────┘
```

---

## New Features Summary

| Feature | Description |
|---------|-------------|
| Animated Marker | Gradient SVG with pulse effect and direction arrow |
| Status Card | Shows speed, battery, sync time in compact bar |
| Center Button | Re-centers map on driver's current location |
| Map Type Toggle | Switch between roadmap and satellite views |
| Enhanced Toggle | On Duty button glows when active |
| Speed Display | Real-time speed from GPS in km/h |
| Heading Arrow | Shows which direction driver is facing |

---

## Dependencies

No new packages required. Uses:
- Existing Google Maps API integration
- Existing `useBackgroundLocationTracking` hook
- Existing interpolation utilities from `mapInterpolation.ts`
- Browser Battery API (already used in tracking hook)

