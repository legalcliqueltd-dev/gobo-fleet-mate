

# Fix: Maximize Map Visibility on Incidents Page

## Problem

The current map height is limited to `40vh` on mobile and `45vh` on tablet, which doesn't provide enough visibility for incident locations.

---

## Solution

Make the map the dominant element on the page by:
1. Increasing map height significantly on all breakpoints
2. Making the events list collapsible/smaller on mobile
3. Keeping the layout map-first on all devices

---

## Changes to `src/pages/ops/Incidents.tsx`

### 1. Increase Map Height

**Line 354** - Change map container heights:

| Breakpoint | Current | New |
|------------|---------|-----|
| Mobile | `h-[40vh]` | `h-[60vh]` |
| Tablet (sm) | `h-[45vh]` | `h-[65vh]` |
| Desktop (lg) | `lg:h-full` | `lg:h-full` (unchanged) |

Also increase `min-h-[250px]` to `min-h-[350px]`.

### 2. Reduce Events List Size on Mobile

**Lines 598-700** - Make the events list more compact:
- Reduce header section size
- Make event cards smaller on mobile
- Add max-height with scroll for the list

### 3. Adjust Overall Container

**Line 341** - Increase available height:
```tsx
// From:
className="h-[calc(100dvh-200px)] flex flex-col"

// To:
className="h-[calc(100dvh-140px)] flex flex-col"
```

This gives ~60px more vertical space for the map.

---

## Technical Details

```tsx
{/* Map Container - Line 354 */}
<div className="
  order-1 lg:order-2 lg:col-span-2 
  glass-card rounded-xl overflow-hidden relative 
  h-[60vh] sm:h-[65vh] lg:h-full 
  min-h-[350px]
">
```

```tsx
{/* Events List - Constrained height on mobile */}
<div className="
  order-2 lg:order-1 lg:col-span-1 
  glass-card rounded-xl overflow-hidden 
  flex flex-col
  max-h-[30vh] sm:max-h-[25vh] lg:max-h-none
">
```

---

## Visual Result

### Mobile Layout (Before vs After)

```
BEFORE:                    AFTER:
+------------------+      +------------------+
| Header           |      | Header (compact) |
+------------------+      +------------------+
|                  |      |                  |
|  MAP (40vh)      |      |                  |
|                  |      |     MAP (60vh)   |
+------------------+      |                  |
|                  |      |                  |
|  Events List     |      +------------------+
|  (long scroll)   |      | Events (compact) |
|                  |      | (scrollable)     |
+------------------+      +------------------+
```

### Desktop Layout

Desktop remains largely unchanged with the 3-column grid (1/3 list, 2/3 map), but the overall height increases.

---

## Summary of Changes

| Element | Change |
|---------|--------|
| Page container | Increase from `100dvh-200px` to `100dvh-140px` |
| Map mobile | From `h-[40vh]` to `h-[60vh]` |
| Map tablet | From `h-[45vh]` to `h-[65vh]` |
| Map min-height | From `min-h-[250px]` to `min-h-[350px]` |
| Events list | Add `max-h-[30vh]` on mobile to prevent overflow |

