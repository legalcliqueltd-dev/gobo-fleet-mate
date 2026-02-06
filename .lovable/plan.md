

# Feature Plan: Task Navigation, iReport Improvements, and SOS Enhancements

## Overview

This plan addresses three related feature requests:
1. **Task Map Navigation** - GPS navigation for drivers to their dropoff locations
2. **iReport Improvements** - Optional proofs, admin viewing, and completion alerts
3. **SOS Admin Alerts** - Ensure admins receive SOS notifications and can delete resolved events

---

## Feature 1: Task Map Navigation

### What It Does
When a driver taps "Navigate" on an active task, the app displays a map showing the shortest driving route from their current location to the dropoff point. The navigation can be dismissed at any time.

### Technical Approach

```text
New Component: src/components/map/TaskNavigationMap.tsx

Uses Google Maps Directions API:
- DirectionsService: Calculates the route
- DirectionsRenderer: Displays the blue route line on the map
- Current location marker (green pulse)
- Destination marker (red pin)
```

### Implementation Steps

| Step | File | Change |
|------|------|--------|
| 1 | `src/components/map/TaskNavigationMap.tsx` | Create new navigation map component using @react-google-maps/api DirectionsRenderer |
| 2 | `src/pages/app/DriverAppTasks.tsx` | Add "Navigate" button next to active tasks |
| 3 | `src/pages/app/DriverAppTasks.tsx` | Add state for selected task navigation, show/hide map overlay |
| 4 | `src/pages/app/DriverAppCompleteTask.tsx` | Add "View Route" button to show navigation while completing |

### UI Flow

```text
Driver Tasks Page:
┌─────────────────────────────┐
│ My Tasks                    │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ 📦 Deliver to Wuse II   │ │
│ │ Due: Today 3:00 PM      │ │
│ │ [Navigate] [Complete]   │ │  ← New "Navigate" button
│ └─────────────────────────┘ │
└─────────────────────────────┘

When Navigate is tapped:
┌─────────────────────────────┐
│ × Close                     │ ← Dismissable
├─────────────────────────────┤
│                             │
│     [MAP WITH ROUTE]        │
│     🟢─────────────🔴       │
│     You          Dropoff    │
│                             │
├─────────────────────────────┤
│ ETA: 15 mins • 4.2 km       │
└─────────────────────────────┘
```

---

## Feature 2: iReport Improvements

### 2a. Make Photo Proof Optional

**Current Behavior:** Drivers must upload at least one photo to complete a task.

**New Behavior:** Photos are optional. Drivers can complete tasks with just a confirmation tap.

| File | Change |
|------|--------|
| `src/pages/app/DriverAppCompleteTask.tsx` | Remove the `mediaFiles.length === 0` validation |
| `src/pages/app/DriverAppCompleteTask.tsx` | Update UI to show "(Optional)" for photos |
| `src/pages/app/DriverAppCompleteTask.tsx` | Change `verified_by` to 'geofence' or 'none' when no photos |

### 2b. Admin Views Proof Pictures

**Current Status:** Already implemented in `TaskList.tsx` (lines 332-350, 391-428).

The admin TaskList already:
- Shows thumbnail previews of photos in the completed tasks column
- Displays full photos in the task detail modal
- Supports clicking images to open full-size in new tab

No changes needed - this feature exists.

### 2c. Admin Alert When Task Completed

**New Feature:** Play audio alert and show toast notification when a driver completes a task.

| File | Change |
|------|--------|
| `src/hooks/useAdminTaskNotifications.ts` | Create new hook for admin-side task completion alerts |
| `src/pages/admin/TaskList.tsx` | Add the hook to trigger audio and toast on task completion |

### Hook Logic

```text
Subscribe to: postgres_changes on 'tasks' table
Filter: status changes to 'completed' or 'delivered'
Condition: task.created_by === admin.id OR task.admin_code matches admin's devices

On Match:
  → Play double-beep sound (same style as driver notifications)
  → Show toast: "✓ Task Completed: [task title] by [driver name]"
```

---

## Feature 3: SOS System Enhancements

### 3a. Admin Receives SOS Alerts

**Current Status:** Already fully implemented.

The system already has:
- `SOSNotificationBell` component shows bell icon with badge count
- Audio alert plays when new SOS arrives
- Toast notification with "View" action
- Real-time subscription to `sos_events` table

The bell is shown in `AppLayout` for admins via the `isAdmin` check in the hook.

No changes needed - this feature exists.

### 3b. Delete Resolved SOS Events

**Current Status:** Already implemented in `Incidents.tsx` (lines 261-283).

The delete functionality exists:
- `deleteEvent()` function calls `supabase.from('sos_events').delete()`
- Confirmation dialog prevents accidental deletion
- Delete button shown for resolved/cancelled events

**Database Note:** The current RLS policy may block deletion. Need to add a DELETE policy.

| File | Change |
|------|--------|
| Database migration | Add RLS policy for DELETE on `sos_events` for admins |

### SQL Migration

```sql
-- Allow admins to delete resolved/cancelled SOS events
CREATE POLICY "sos_delete_resolved_admin" ON public.sos_events
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    AND status IN ('resolved', 'cancelled')
  );
```

---

## Summary of Changes

| Category | File | Type | Description |
|----------|------|------|-------------|
| Navigation | `src/components/map/TaskNavigationMap.tsx` | New | Google Maps directions component |
| Navigation | `src/pages/app/DriverAppTasks.tsx` | Modify | Add Navigate button and map overlay |
| Navigation | `src/pages/app/DriverAppCompleteTask.tsx` | Modify | Add View Route button |
| iReport | `src/pages/app/DriverAppCompleteTask.tsx` | Modify | Make photos optional |
| Admin Alert | `src/hooks/useAdminTaskNotifications.ts` | New | Task completion notification hook |
| Admin Alert | `src/pages/admin/TaskList.tsx` | Modify | Integrate admin notification hook |
| SOS Delete | Supabase migration | New | Add DELETE RLS policy for admins |

---

## Technical Details

### Google Maps Directions API

The `@react-google-maps/api` library is already installed. Implementation will use:

```typescript
import { DirectionsRenderer, DirectionsService } from '@react-google-maps/api';

// Request driving directions
<DirectionsService
  options={{
    origin: { lat: driverLat, lng: driverLng },
    destination: { lat: dropoffLat, lng: dropoffLng },
    travelMode: google.maps.TravelMode.DRIVING,
  }}
  callback={(result, status) => {
    if (status === 'OK') setDirections(result);
  }}
/>

// Render the route on map
<DirectionsRenderer directions={directions} />
```

### Admin Task Notification Hook

```typescript
// Subscribe to task status changes
supabase.channel('admin-task-completions')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'tasks',
  }, (payload) => {
    const task = payload.new;
    const oldStatus = payload.old?.status;
    
    if (oldStatus !== 'completed' && task.status === 'completed') {
      playSound();
      toast.success(`Task Completed: ${task.title}`);
    }
  })
  .subscribe();
```

---

## Validation

After implementation:

1. **Task Navigation**
   - Tap Navigate on a task → Map shows route
   - Close button dismisses the map
   - Route updates if driver moves

2. **Optional iReport**
   - Complete a task without photos → Succeeds
   - Complete a task with photos → Succeeds with photos stored

3. **Admin Completion Alert**
   - Driver completes task → Admin hears beep and sees toast

4. **SOS Deletion**
   - Resolve an SOS → Delete button appears
   - Click delete → Confirmation dialog → Event removed

