

# Fix: SOS Details Panel Obstructing Map

## Problem

The selected SOS event details panel is positioned at the bottom of the map with `left-4 right-4`, covering a large portion of the map view and obscuring the incident location.

## Solution

Reposition the details panel to be a **side drawer on the right** that overlays less of the map, with a more compact design.

---

## Changes to `src/pages/ops/Incidents.tsx`

### Line 544-687: Reposition Details Panel

**Current positioning:**
```tsx
className="absolute bottom-4 left-4 right-4 glass-card rounded-xl p-4 max-w-lg max-h-[60%] overflow-y-auto shadow-2xl"
```

**New positioning - Side panel on right:**
```tsx
className="absolute top-16 right-4 w-80 glass-card rounded-xl p-4 max-h-[calc(100%-5rem)] overflow-y-auto shadow-2xl"
```

### Key Changes:

1. **Position**: Move from bottom overlay to right side panel
   - `top-16` (below the map type toggle buttons)
   - `right-4` (aligned to right edge)
   - Remove `left-4` and `bottom-4`

2. **Size**: Fixed width instead of spanning full width
   - `w-80` (320px fixed width)
   - `max-h-[calc(100%-5rem)]` (full height minus padding)

3. **Compact driver info**: Reduce avatar size and tighten spacing

4. **Smaller action buttons**: More compact layout

---

## Visual Result

```
+------------------+------------------+
| Events List      |    MAP           |   <- Map type toggle top-right
|                  |                  |   <- Details panel right side
| Active (3)       |        [Pin]     |      below toggle
|  - Driver A      |                  |   +-------------+
|  - Driver B      |                  |   | Driver Name |
|                  |                  |   | Code: XXX   |
| Resolved (2)     |                  |   | HAZARD      |
|  - Driver C      |                  |   | [Zoom][Maps]|
|                  |                  |   +-------------+
+------------------+------------------+
```

The panel will be positioned on the right side of the map, leaving the center clear to view incident locations.

---

## Technical Details

The fix requires modifying the CSS classes on line 546 of `Incidents.tsx`:

**From:**
```tsx
<div className="absolute bottom-4 left-4 right-4 glass-card rounded-xl p-4 max-w-lg max-h-[60%] overflow-y-auto shadow-2xl">
```

**To:**
```tsx
<div className="absolute top-16 right-4 w-80 glass-card rounded-xl p-4 max-h-[calc(100%-5rem)] overflow-y-auto shadow-2xl border border-border/50">
```

Additional UI refinements:
- Reduce avatar container from `w-12 h-12` to `w-10 h-10`
- Make action buttons stack vertically for better fit
- Reduce padding slightly

