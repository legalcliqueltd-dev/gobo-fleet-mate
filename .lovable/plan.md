

# Dashboard "Your Devices" Enhancement Plan

## Overview

This plan updates the "Your Devices" section on the admin dashboard to show device name and connection code directly in each card, removing the need to navigate to a separate details page. It also improves overall dashboard responsiveness.

---

## Changes Required

### 1. Update Device Data Hook

**File**: `src/hooks/useDeviceLocations.ts`

Add `connection_code` to the Supabase query and type definition:

```text
Current query selects:
  id, user_id, name, imei, status, created_at, is_temporary

Updated query adds:
  connection_code
```

**Updated Type**:
```typescript
export type Device = {
  id: string;
  user_id: string;
  name: string | null;
  imei: string | null;
  status: 'active' | 'idle' | 'offline' | null;
  created_at: string;
  is_temporary?: boolean;
  connection_code?: string | null;  // NEW
};
```

---

### 2. Update "Your Devices" Cards in Dashboard

**File**: `src/pages/Dashboard.tsx`

**Current Card Layout**:
```text
[Status Dot] Device Name    [TEMP badge]    [Link] [Delete]
[Clock] Last location timestamp
```

**New Card Layout**:
```text
[Status Dot] Device Name    [TEMP badge]           [Delete]
Code: XXXXXXXX                              [Copy button]
[Clock] Last location timestamp
```

**Changes**:
- Remove the `ExternalLink` icon (line 289-291)
- Add connection code display with inline copy button
- Show "No code" message if device has no connection_code
- Add copy-to-clipboard functionality with toast feedback

---

### 3. Remove Device Details Page Navigation

**File**: `src/pages/Dashboard.tsx`

- Remove the `<Link to={/devices/${d.id}}>` element
- Keep single-click on device card for map focus only

**Note**: The `/devices/:id` route can remain in `App.tsx` for direct URL access if needed, but will no longer be navigated to from the dashboard.

---

### 4. Dashboard UI/Responsiveness Improvements

**File**: `src/pages/Dashboard.tsx`

| Issue | Fix |
|-------|-----|
| Empty space on mobile | Reduce padding: `p-2` on mobile, `p-3` on tablet, `p-4` on desktop |
| Map not using full height | Increase min-height: `min-h-[50vh] md:min-h-[60vh] lg:min-h-[70vh]` |
| Stats cards crowded | Keep current responsive grid, add horizontal scroll on very small screens |
| Driver list max-height | Increase from 200px/280px to 250px/350px |
| Card spacing | Reduce gap from `space-y-3` to `space-y-2` on mobile |
| Device cards too tall | Make more compact with tighter padding |

**Layout Grid Adjustment**:
```text
Current: grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px]
Updated: grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px]
```
Slightly narrower sidebar to give more space to the map.

---

## New Device Card Design

Each device card will show:

```text
+-------------------------------------------+
| [●] Fleet Van #1              [🗑️ Delete] |
| Code: AC3F2B57                   [📋]     |
| 🕐 Jan 3, 2026, 2:30:45 PM               |
+-------------------------------------------+
```

- Status dot (green/amber/gray)
- Device name (bold)
- TEMP badge if temporary device
- Connection code with copy button
- Last location timestamp
- Delete button only (no external link)

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useDeviceLocations.ts` | Add `connection_code` to query and type |
| `src/pages/Dashboard.tsx` | Update device cards, improve responsiveness |

---

## Implementation Notes

1. **Copy to Clipboard**: Use `navigator.clipboard.writeText()` with a brief "Copied!" toast using `sonner`

2. **No Code State**: If a device has no `connection_code`, show "No code assigned" in muted text

3. **Responsive Padding**:
   - Mobile: `p-2`
   - Tablet: `p-3`  
   - Desktop: `p-4`

4. **Backward Compatibility**: Keep `/devices/:id` route in case users have bookmarked it

---

## What Stays the Same

- "Connected Drivers" section (DriversList component) - no changes
- Map functionality - unchanged
- Stats banner - unchanged (just better responsive behavior)
- Quick Actions card - unchanged
- Driver App Download card - unchanged

