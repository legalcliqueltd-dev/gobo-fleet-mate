
# Implementation Plan: Task System & SOS Admin Notifications

## Overview

This plan addresses four key issues:
1. Fix task assignment to work with mobile drivers (using `drivers` table)
2. Add in-app notification for drivers when new tasks are assigned
3. Enable screenshot/proof upload for completed tasks in mobile app
4. Add Tasks to admin navigation bar
5. Fix SOS notification bell visibility for admins

---

## Issue Analysis

### Current Architecture Mismatch

The task system has a critical disconnect:
- **Admin CreateTask**: Loads drivers from `driver_connections` table (UUID-based auth users)
- **Mobile App**: Uses text-based `driver_id` from `drivers` table
- **Tasks Table**: Uses `assigned_user_id` (UUID) which doesn't match mobile driver IDs

This means tasks created by admins will NOT appear for mobile drivers.

---

## Phase 1: Database Schema Updates

### 1.1 Add `assigned_driver_id` to Tasks Table

Add a new column to link tasks to mobile drivers:

```sql
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS assigned_driver_id TEXT 
REFERENCES public.drivers(driver_id);

ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS admin_code TEXT;

CREATE INDEX IF NOT EXISTS tasks_assigned_driver_id_idx 
ON public.tasks(assigned_driver_id);

CREATE INDEX IF NOT EXISTS tasks_admin_code_idx 
ON public.tasks(admin_code);
```

### 1.2 Ensure Admin Role Exists

Grant admin role to device owners:

```sql
-- Add admin role for users who own devices
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'admin'::app_role 
FROM public.devices 
WHERE user_id IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;
```

---

## Phase 2: Admin Task Assignment

### 2.1 Update CreateTask.tsx

**Current Problem**: Loads drivers from `driver_connections` which uses UUID auth users.

**Solution**: Load drivers from the `drivers` table instead, filtered by admin's device connection codes.

**Changes to `src/pages/admin/CreateTask.tsx`**:

1. Update `loadDrivers()` function:
   - Get admin's devices and their connection codes
   - Query `drivers` table where `admin_code` matches any of the admin's device codes
   - Display driver names with their connection status

2. Update task creation:
   - Set `assigned_driver_id` (text) instead of `assigned_user_id` (UUID)
   - Set `admin_code` for task isolation

**Driver Type Update**:
```typescript
type Driver = {
  driver_id: string;    // TEXT from drivers table
  driver_name: string;
  admin_code: string;
  status: string;
  last_seen_at: string | null;
};
```

---

## Phase 3: Mobile Driver Task Notifications

### 3.1 Create Task Notification Hook

**New File**: `src/hooks/useTaskNotifications.ts`

Features:
- Subscribe to real-time changes on `tasks` table filtered by driver's ID
- Play audio alert when new task is assigned
- Show toast notification with task title
- Return unread task count for badge display

### 3.2 Update DriverAppLayout

Add notification badge to Tasks icon in bottom nav showing unread task count.

### 3.3 Update DriverAppTasks Query

Change from:
```typescript
.eq('assigned_user_id', session.driverId)
```

To:
```typescript
.eq('assigned_driver_id', session.driverId)
```

---

## Phase 4: Task Proof Upload (Screenshots)

### 4.1 Create Mobile Task Completion Page

**New File**: `src/pages/app/DriverAppCompleteTask.tsx`

A mobile-optimized task completion flow:

1. **Photo Capture**:
   - Camera button to take photos
   - Gallery of captured photos
   - Upload to `proofs` storage bucket

2. **Notes**:
   - Optional text notes about completion

3. **Submit**:
   - Create task_report entry
   - Update task status to 'delivered'
   - Navigate back to tasks list

**Key Components**:
- File input with `capture="environment"` for camera access
- Progress indicator during upload
- Success confirmation

### 4.2 Update DriverAppTasks

Change the "Complete" button to navigate to the new mobile completion page:
```typescript
onClick={() => navigate(`/app/tasks/${task.id}/complete`)}
```

### 4.3 Add Route in App.tsx

Add new route under `/app/*`:
```typescript
<Route path="/tasks/:taskId/complete" element={
  <DriverProtectedRoute>
    <DriverAppCompleteTask />
  </DriverProtectedRoute>
} />
```

---

## Phase 5: Admin Navigation Updates

### 5.1 Update AppLayout.tsx

Add Tasks and SOS to the navigation bar:

```typescript
const navItems = [
  { path: '/dashboard', icon: Home, label: 'Home' },
  { path: '/admin/tasks', icon: ClipboardList, label: 'Tasks' },
  { path: '/ops/incidents', icon: AlertTriangle, label: 'SOS' },
  { path: '/settings', icon: Settings, label: 'Settings' },
];
```

---

## Phase 6: Fix SOS Bell Visibility

### 6.1 Auto-Grant Admin Role

The SOS bell requires `admin` role in `user_roles`. We need to ensure device owners have this role.

**Option A** (Recommended): Database trigger on device creation
**Option B**: Update the `useSOSNotifications` hook to check device ownership instead of role

For immediate fix, run the SQL from Phase 1.2 to grant admin role to existing device owners.

### 6.2 Verify SOS Query Includes admin_code

The `useSOSNotifications` hook already filters by `admin_code`, which was added in the previous update. Verify this is working correctly.

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `src/pages/app/DriverAppCompleteTask.tsx` | Mobile task completion with photo upload |
| `src/hooks/useTaskNotifications.ts` | Real-time task assignment notifications |

### Modified Files
| File | Changes |
|------|---------|
| `src/pages/admin/CreateTask.tsx` | Load drivers from `drivers` table, use `assigned_driver_id` |
| `src/pages/app/DriverAppTasks.tsx` | Query by `assigned_driver_id`, update Complete navigation |
| `src/components/layout/AppLayout.tsx` | Add Tasks and SOS to nav |
| `src/components/layout/DriverAppLayout.tsx` | Add task notification badge |
| `src/App.tsx` | Add task completion route |

### Database Migrations
| Migration | Purpose |
|-----------|---------|
| Add `assigned_driver_id` column | Link tasks to mobile drivers |
| Add `admin_code` column to tasks | Task isolation by admin |
| Insert admin roles | Enable SOS bell visibility |

---

## Technical Details

### Task Assignment Flow (After Fix)

```
1. Admin opens CreateTask
2. System fetches admin's device connection codes
3. System queries drivers table where admin_code IN (admin's codes)
4. Admin selects driver and creates task
5. Task saved with assigned_driver_id (text) and admin_code
6. Mobile app receives real-time notification
7. Driver sees task in their list
8. Driver completes with photo proof
9. Admin sees proof in ops console
```

### Storage Structure for Proofs

```
proofs/
  {driver_id}/
    {task_id}/
      {timestamp}_photo1.jpg
      {timestamp}_photo2.jpg
```

### Notification Sound

Reuse the existing audio alert pattern from SOS notifications - a double beep using Web Audio API.

---

## Testing Checklist

After implementation:

1. **Admin Task Creation**:
   - [ ] CreateTask shows drivers from `drivers` table
   - [ ] Task created with `assigned_driver_id` 

2. **Mobile Driver**:
   - [ ] Tasks appear in driver app
   - [ ] Notification appears when new task assigned
   - [ ] Can upload photos to complete task
   - [ ] Task shows as delivered after completion

3. **SOS System**:
   - [ ] Bell icon visible in admin header
   - [ ] SOS alerts show for admin's drivers only
   - [ ] Audio plays on new SOS

4. **Navigation**:
   - [ ] Tasks link in admin nav bar
   - [ ] SOS link in admin nav bar
