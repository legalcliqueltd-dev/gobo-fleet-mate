
# Implementation Plan: Admin UI Enhancements, SOS Improvements & Task System Optimization

## Overview

This plan addresses the following requirements:
1. **Navigation bar UI adjustment** - Polish the floating nav appearance
2. **SOS driver identification** - Display driver name and code on SOS events
3. **Overall UI improvements** - Enhance nav bar, SOS, and task sections
4. **SOS map features** - Zoom to exact location, satellite view, delete resolved SOS
5. **Task system optimization** - Focus on assigning tasks (admin sends), support media uploads (photos, videos <5MB)

---

## Phase 1: Navigation Bar UI Improvements

### Current Issues
- The floating nav bar on desktop has 4 items but could use better visual polish
- Mobile nav menu doesn't match the main nav items

### Changes to `src/components/layout/AppLayout.tsx`

1. **Polish the floating nav bar design**:
   - Add subtle shadow and better contrast
   - Improve icon sizing and spacing
   - Add subtle hover animations

2. **Sync mobile menu with desktop nav**:
   - Show same 4 items: Home, Tasks, SOS, Settings
   - Add Tasks link to mobile menu

3. **Visual refinements**:
   - Slightly larger nav bar with better rounded corners
   - Better active state indicator animation

---

## Phase 2: SOS System Enhancements

### 2.1 Display Driver Name & Code in SOS Events

**Changes to `src/pages/ops/Incidents.tsx`**:

1. **Fetch driver code along with driver info**:
   - Query the `drivers` table to get `driver_id` (the connection code) alongside the driver name
   - If `user_id` in SOS event is a text-based driver_id, look up from `drivers` table
   - Display format: "Driver Name (CODE123)"

2. **Update the SOS event card UI**:
   - Add driver code badge below driver name
   - Make it visually prominent with a monospace font

3. **Update selected event details panel**:
   - Show driver code clearly
   - Include admin_code for reference

### 2.2 Map Zoom & Satellite View

**Changes to `src/pages/ops/Incidents.tsx`**:

1. **Add "Zoom to Location" button**:
   - When SOS is selected, add a button to zoom map to zoom level 18 (street level)
   - Pan and zoom animation

2. **Add Satellite/Hybrid view toggle**:
   - Add a map type toggle button overlay
   - Options: Roadmap, Satellite, Hybrid
   - Store preference in local state

3. **Improve marker visibility on satellite**:
   - Add white stroke/shadow to markers for visibility on dark satellite imagery

### 2.3 Delete Resolved/Seen SOS Events

**Changes to `src/pages/ops/Incidents.tsx`**:

1. **Add delete functionality**:
   - Add a trash icon button next to resolved SOS events
   - Only show for resolved/cancelled status
   - Confirmation dialog before deletion

2. **Add "Clear All Resolved" button**:
   - Bulk delete option for resolved events
   - Confirmation modal

3. **Database operation**:
   - Delete from `sos_events` table (admin only)

---

## Phase 3: Task System Optimization

### 3.1 Admin Task Management Page

The current `CreateTask.tsx` is for creating tasks. We need a proper task list view for admins.

**Create new file: `src/pages/admin/TaskList.tsx`**

This page will show:
1. **All tasks created by admin** - Organized by status
2. **Task assignment focus** - Quick assign to drivers
3. **Feedback from drivers** - View proofs, photos, notes

**Key sections**:
- Pending/Assigned tasks (waiting for driver action)
- In Progress tasks (driver en route)
- Completed tasks (with proof attachments)
- Status filters and search

### 3.2 Support for Screenshots, Photos & Short Videos

**Changes to `src/pages/app/DriverAppCompleteTask.tsx`**:

1. **Accept video files**:
   - Update file input to accept `video/*` in addition to `image/*`
   - Add file size validation (max 5MB per file)
   - Show file type indicator (photo vs video)

2. **Video preview**:
   - Show video thumbnail/player for uploaded videos
   - Display file size warning if over limit

3. **Storage bucket update**:
   - Videos will be stored in the same `proofs` bucket
   - Add content-type header for proper playback

**Changes to admin task view**:
- Display video proofs with playback controls
- Thumbnail grid for photos

### 3.3 Update Navigation Route

**Changes to `src/App.tsx`**:
- Ensure `/admin/tasks` route shows the task list (not create)
- Add `/admin/tasks/new` for creating tasks

---

## Phase 4: UI Polish & Visual Improvements

### 4.1 SOS Page Visual Overhaul

**Key improvements to `src/pages/ops/Incidents.tsx`**:

1. **Header section**:
   - More prominent active incident counter
   - Quick actions (export, filter)

2. **Event cards**:
   - Larger driver avatar area
   - More visible driver code (monospace, badge style)
   - Time since alert (more prominent)

3. **Map overlay panel**:
   - Cleaner design with clear sections
   - Action buttons with better hierarchy
   - "Open in Google Maps" link

### 4.2 Task Section Polish

**Key improvements**:

1. **Admin create task page**:
   - Better map instructions
   - Driver selection with status indicators
   - Preview before creating

2. **Driver app tasks**:
   - Cleaner card design
   - Progress indicators
   - Better status colors

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/pages/admin/TaskList.tsx` | Admin task list with filtering and feedback view |

### Modified Files
| File | Changes |
|------|---------|
| `src/components/layout/AppLayout.tsx` | Nav bar UI polish, sync mobile menu |
| `src/pages/ops/Incidents.tsx` | Driver code display, satellite view, zoom, delete SOS |
| `src/pages/app/DriverAppCompleteTask.tsx` | Video support, 5MB limit validation |
| `src/pages/admin/CreateTask.tsx` | UI improvements |
| `src/App.tsx` | Add /admin/tasks route for TaskList |
| `src/hooks/useSOSNotifications.ts` | Include driver_id in enriched data |

---

## Technical Details

### SOS Driver Identification Logic

The challenge is that `sos_events.user_id` may contain either:
- A UUID (Supabase auth user) - look up in `profiles`
- A text driver_id - look up in `drivers`

Solution: Check the format of `user_id`:
```typescript
// If user_id looks like a UUID, query profiles
// If it's a short code, query drivers table
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(event.user_id);
```

Or simpler: Query both and use whichever returns data.

### Video Upload File Size Check

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

const handleMediaCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files) return;

  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`${file.name} is too large. Maximum 5MB allowed.`);
      continue;
    }
    // Add to upload queue
  }
};
```

### Map Satellite Toggle

```typescript
const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');

<GoogleMap
  options={{
    mapTypeId: mapType,
    mapTypeControl: false, // Hide default, use custom
  }}
/>

// Custom toggle button overlay
<div className="absolute top-4 right-4">
  <Button onClick={() => setMapType(t => t === 'roadmap' ? 'satellite' : 'roadmap')}>
    {mapType === 'roadmap' ? 'Satellite' : 'Map'}
  </Button>
</div>
```

### Delete SOS Event

```typescript
const deleteEvent = async (eventId: string) => {
  if (!confirm('Are you sure you want to delete this SOS event?')) return;
  
  const { error } = await supabase
    .from('sos_events')
    .delete()
    .eq('id', eventId);

  if (!error) {
    toast.success('SOS event deleted');
    loadEvents();
    if (selectedEvent?.id === eventId) {
      setSelectedEvent(null);
    }
  }
};
```

---

## UI Design Specifications

### Floating Nav Bar (Desktop)
```
- Background: white/95 dark:slate-900/95 with backdrop-blur-lg
- Border: subtle border with 50% opacity
- Padding: px-5 py-2.5 (slightly larger)
- Border radius: rounded-2xl (more rounded)
- Shadow: shadow-lg (more prominent)
- Active indicator: bg-primary/20 (more visible)
```

### SOS Event Card
```
- Driver name: font-semibold text-base
- Driver code: font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded
- Hazard badge: larger emoji, uppercase type
- Time: prominent with relative format
```

### Task Completion Media
```
- Accept: image/*, video/mp4, video/quicktime
- Max size: 5MB per file
- Grid: 3 columns for photos, full width for videos
- Video preview: max-h-48 with play button overlay
```

---

## Testing Checklist

After implementation:

1. **Navigation**:
   - [ ] Floating nav bar shows all 4 items properly
   - [ ] Mobile menu matches desktop nav
   - [ ] Active state indicator works

2. **SOS System**:
   - [ ] Driver name AND code visible in SOS events
   - [ ] Zoom to location works
   - [ ] Satellite view toggle works
   - [ ] Delete resolved SOS works
   - [ ] Delete confirmation appears

3. **Task System**:
   - [ ] Admin can create and assign tasks
   - [ ] Admin can view task list with feedback
   - [ ] Driver can upload photos AND videos
   - [ ] 5MB limit enforced with error message
   - [ ] Videos play back in admin view

4. **Overall UI**:
   - [ ] Polish looks clean on desktop
   - [ ] Mobile views work properly
   - [ ] Dark mode works for all changes
