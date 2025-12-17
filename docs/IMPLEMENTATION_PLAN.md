# Complete Implementation Plan: Tracking, SOS & Tasks

## Executive Summary

This document outlines the complete implementation plan to fix three interconnected systems:
1. **Live Location Tracking** - Ensure accurate, continuous driver visibility on admin map
2. **SOS Emergency System** - Enable drivers to trigger emergencies from mobile app
3. **Task Assignment** - Allow admins to assign and track tasks for drivers

### Root Cause Analysis

The current architecture has **two disconnected driver systems**:

| System | Used By | Authentication | Tables |
|--------|---------|----------------|--------|
| **Supabase Auth** | Web app (SOS, Tasks) | Email/password + OAuth | `profiles`, `user_roles`, `sos_events`, `tasks` |
| **Anonymous Code-Based** | Rocket Mobile App | Connection code only | `drivers`, `driver_locations`, `driver_location_history` |

**The solution**: Extend the anonymous code-based system to support SOS and Tasks, making it work seamlessly with the Rocket mobile app.

---

## Phase 1: Live Location Tracking (Priority: CRITICAL)

### Problem Statement
Drivers appear offline on admin dashboard because:
1. Rocket app is NOT sending continuous location updates
2. No background tracking implementation
3. No heartbeat/status updates being sent

### 1.1 Database Changes

**No database changes required** - tables already exist:
- `drivers` - stores driver info and `last_seen_at`
- `driver_locations` - stores current location (upsert)
- `driver_location_history` - stores historical trail

### 1.2 Edge Function Updates

Update `supabase/functions/connect-driver/index.ts` to handle location updates better:

```typescript
// Current actions supported:
// - connect: Register driver with code
// - update-location: Update GPS position
// - update-status: Heartbeat ping
// - get-connection: Check connection status
// - disconnect: End session
```

**Changes needed:**
1. Add `battery_level` field to location updates
2. Add `is_background` flag to track if update is from background service
3. Return `server_time` for clock sync

### 1.3 Rocket Mobile App Requirements

#### A. Background Location Service (CRITICAL)

```kotlin
// AndroidManifest.xml permissions required:
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_LOCATION" />
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

#### B. Location Tracking Service

```kotlin
class LocationTrackingService : Service() {
    // Must run as foreground service with persistent notification
    // Update interval: 15-30 seconds when moving, 60 seconds when stationary
    // Battery optimization: reduce frequency when battery < 20%
    
    companion object {
        const val UPDATE_INTERVAL_MOVING = 15_000L      // 15 seconds
        const val UPDATE_INTERVAL_STATIONARY = 60_000L  // 60 seconds
        const val UPDATE_INTERVAL_LOW_BATTERY = 120_000L // 2 minutes
    }
}
```

#### C. API Calls Required

**1. Location Update (every 15-30 seconds):**
```http
POST https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver
Content-Type: application/json

{
  "action": "update-location",
  "driverId": "driver_unique_id",
  "latitude": 9.0820,
  "longitude": 8.6753,
  "speed": 45.5,
  "accuracy": 10.0,
  "bearing": 180.0,
  "batteryLevel": 85,
  "isBackground": true
}
```

**2. Heartbeat (every 30-60 seconds):**
```http
POST https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver
Content-Type: application/json

{
  "action": "update-status",
  "driverId": "driver_unique_id",
  "status": "active"
}
```

#### D. Boot Receiver (Auto-start on phone restart)

```kotlin
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            // Check if driver was previously connected
            val prefs = context.getSharedPreferences("driver_prefs", Context.MODE_PRIVATE)
            val driverId = prefs.getString("driver_id", null)
            val adminCode = prefs.getString("admin_code", null)
            
            if (driverId != null && adminCode != null) {
                // Restart location tracking service
                LocationTrackingService.start(context, driverId, adminCode)
            }
        }
    }
}
```

#### E. Error Handling

```kotlin
// Handle server response for deleted/invalid driver
when {
    response.requiresRelogin == true -> {
        // Driver was removed by admin
        stopTracking()
        clearLocalStorage()
        showNotification("Your connection was terminated by admin")
        navigateToLoginScreen()
    }
    response.error == "Driver not found" -> {
        // Re-register with stored admin code
        reconnectWithCode(storedAdminCode, storedDriverName)
    }
}
```

### 1.4 Web App Changes

#### A. Update `useRealtimeDriverLocations.ts`

Current implementation is correct but needs:
1. Better handling of stale data
2. Show "last updated X minutes ago" indicator
3. Visual indicator when driver hasn't updated in > 2 minutes

#### B. Update `LiveDriverMap.tsx`

Add:
1. Accuracy circle around driver marker
2. Last update timestamp on marker popup
3. "Stale" visual state for drivers not updated in > 5 minutes

### 1.5 Acceptance Criteria

- [ ] Driver location updates every 15-30 seconds when app is in foreground
- [ ] Driver location updates every 30-60 seconds when app is in background
- [ ] Tracking auto-starts when phone boots (if previously connected)
- [ ] Tracking continues when app is closed
- [ ] Admin sees driver position within 30 seconds of actual location
- [ ] Admin sees "stale" indicator if no update in 5+ minutes
- [ ] Battery usage is optimized (< 5% per hour)

---

## Phase 2: SOS Emergency System

### Problem Statement
Current SOS system requires Supabase Auth, but Rocket app drivers use anonymous code-based auth.

### 2.1 Database Changes

**Migration: Add driver_id support to sos_events**

```sql
-- Add driver_id column for anonymous drivers
ALTER TABLE public.sos_events 
ADD COLUMN driver_id TEXT REFERENCES public.drivers(driver_id) ON DELETE SET NULL;

-- Add admin_code to link SOS to admin
ALTER TABLE public.sos_events
ADD COLUMN admin_code TEXT;

-- Make user_id nullable (for anonymous driver SOS)
ALTER TABLE public.sos_events 
ALTER COLUMN user_id DROP NOT NULL;

-- Add index for driver lookups
CREATE INDEX idx_sos_events_driver_id ON public.sos_events(driver_id);
CREATE INDEX idx_sos_events_admin_code ON public.sos_events(admin_code);

-- Update RLS to allow anonymous drivers to create SOS
CREATE POLICY "sos_insert_anonymous_driver" ON public.sos_events
FOR INSERT WITH CHECK (
  driver_id IS NOT NULL AND admin_code IS NOT NULL
);

-- Allow admins to view SOS by admin_code
CREATE POLICY "sos_select_by_admin_code" ON public.sos_events
FOR SELECT USING (
  admin_code IN (
    SELECT connection_code FROM public.devices WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin')
);
```

### 2.2 Edge Function: create-sos

Create new edge function for anonymous driver SOS:

**File: `supabase/functions/create-sos/index.ts`**

```typescript
// Handles SOS creation from Rocket mobile app
// Actions:
// - create: Create new SOS event
// - update-position: Update SOS location
// - cancel: Driver cancels SOS

// Request body:
{
  "action": "create",
  "driverId": "driver_unique_id",
  "adminCode": "ABC12345",
  "hazard": "accident|medical|robbery|breakdown|other",
  "message": "Optional description",
  "latitude": 9.0820,
  "longitude": 8.6753,
  "photoBase64": "optional_base64_image"
}

// Response:
{
  "success": true,
  "sosId": "uuid",
  "message": "SOS created - admin notified"
}
```

### 2.3 Rocket Mobile App Requirements

#### A. SOS Button Implementation

```kotlin
// UI Requirements:
// - Large red circular button
// - Hold for 3 seconds to activate (prevents accidental triggers)
// - Vibration feedback during countdown
// - Visual countdown indicator (3...2...1)
// - Cancel option during countdown

class SOSButton : View {
    private val HOLD_DURATION = 3000L // 3 seconds
    
    fun onLongPressStart() {
        startCountdown()
        startVibration()
    }
    
    fun onCountdownComplete() {
        showHazardTypeDialog()
    }
}
```

#### B. Hazard Type Selection

```kotlin
enum class HazardType {
    ACCIDENT,    // Vehicle collision
    MEDICAL,     // Health emergency
    ROBBERY,     // Security threat
    BREAKDOWN,   // Vehicle malfunction
    OTHER        // Custom description
}
```

#### C. API Calls

**1. Create SOS:**
```http
POST https://invbnyxieoyohahqhbir.supabase.co/functions/v1/create-sos
Content-Type: application/json

{
  "action": "create",
  "driverId": "driver_unique_id",
  "adminCode": "ABC12345",
  "hazard": "accident",
  "message": "Rear-ended at intersection",
  "latitude": 9.0820,
  "longitude": 8.6753
}
```

**2. Position Updates (every 30 seconds while SOS is active):**
```http
POST https://invbnyxieoyohahqhbir.supabase.co/functions/v1/create-sos
Content-Type: application/json

{
  "action": "update-position",
  "sosId": "sos_uuid",
  "driverId": "driver_unique_id",
  "latitude": 9.0821,
  "longitude": 8.6754
}
```

**3. Cancel SOS:**
```http
POST https://invbnyxieoyohahqhbir.supabase.co/functions/v1/create-sos
Content-Type: application/json

{
  "action": "cancel",
  "sosId": "sos_uuid",
  "driverId": "driver_unique_id"
}
```

#### D. Photo Upload

```kotlin
// Compress image before upload
fun compressImage(bitmap: Bitmap): ByteArray {
    val stream = ByteArrayOutputStream()
    bitmap.compress(Bitmap.CompressFormat.JPEG, 70, stream)
    return stream.toByteArray()
}

// Convert to base64 for API
fun toBase64(bytes: ByteArray): String {
    return Base64.encodeToString(bytes, Base64.NO_WRAP)
}
```

### 2.4 Web App Changes

#### A. Update `useSOSNotifications.ts`

Modify to also fetch SOS events linked by `admin_code`:

```typescript
// Fetch SOS for both user_id (web drivers) and admin_code (mobile drivers)
const { data } = await supabase
  .from('sos_events')
  .select(`
    *,
    drivers!sos_events_driver_id_fkey(driver_name)
  `)
  .or(`user_id.eq.${userId},admin_code.in.(${adminCodes.join(',')})`)
  .order('created_at', { ascending: false });
```

#### B. Update `/ops/incidents` Page

Show driver name from either:
- `profiles` table (for web users)
- `drivers` table (for mobile app drivers)

### 2.5 Acceptance Criteria

- [ ] Driver can trigger SOS by holding button for 3 seconds
- [ ] Driver can select hazard type
- [ ] Driver can add optional message
- [ ] Driver can attach photo
- [ ] SOS appears immediately on admin dashboard
- [ ] Admin receives audio alert for new SOS
- [ ] Admin sees driver name and current location
- [ ] Driver position updates every 30 seconds while SOS is active
- [ ] Driver can cancel open SOS
- [ ] Admin can acknowledge and resolve SOS

---

## Phase 3: Task Assignment System

### Problem Statement
Current task system only works with Supabase Auth users, not anonymous code-based drivers.

### 3.1 Database Changes

**Migration: Add driver_id support to tasks**

```sql
-- Add driver_id column for anonymous drivers
ALTER TABLE public.tasks 
ADD COLUMN assigned_driver_id TEXT REFERENCES public.drivers(driver_id) ON DELETE SET NULL;

-- Add admin_code to link task to admin
ALTER TABLE public.tasks
ADD COLUMN admin_code TEXT;

-- Make assigned_user_id nullable (for anonymous driver tasks)
ALTER TABLE public.tasks 
ALTER COLUMN assigned_user_id DROP NOT NULL;

-- Add index for driver lookups
CREATE INDEX idx_tasks_assigned_driver_id ON public.tasks(assigned_driver_id);
CREATE INDEX idx_tasks_admin_code ON public.tasks(admin_code);

-- Add constraint: either assigned_user_id OR assigned_driver_id must be set
ALTER TABLE public.tasks
ADD CONSTRAINT tasks_assignee_check 
CHECK (assigned_user_id IS NOT NULL OR assigned_driver_id IS NOT NULL);

-- Update RLS for anonymous drivers
CREATE POLICY "tasks_select_by_driver_id" ON public.tasks
FOR SELECT USING (
  assigned_driver_id IS NOT NULL
);

-- Allow task updates by admin_code owner
CREATE POLICY "tasks_update_by_admin_code" ON public.tasks
FOR UPDATE USING (
  admin_code IN (
    SELECT connection_code FROM public.devices WHERE user_id = auth.uid()
  )
);
```

### 3.2 Edge Function: driver-tasks

Create new edge function for anonymous driver task management:

**File: `supabase/functions/driver-tasks/index.ts`**

```typescript
// Handles task operations for Rocket mobile app
// Actions:
// - list: Get assigned tasks
// - accept: Accept a task
// - start: Start working on task
// - complete: Mark task complete with POD
// - reject: Reject a task

// List tasks request:
{
  "action": "list",
  "driverId": "driver_unique_id",
  "adminCode": "ABC12345",
  "status": "assigned|in_progress|completed|all"
}

// Complete task request:
{
  "action": "complete",
  "driverId": "driver_unique_id",
  "taskId": "task_uuid",
  "latitude": 9.0820,
  "longitude": 8.6753,
  "receiverName": "John Doe",
  "receiverPhone": "08012345678",
  "signatureBase64": "base64_signature",
  "photoBase64": "base64_photo",
  "note": "Delivered to security"
}
```

### 3.3 Web App Changes

#### A. Update `CreateTask.tsx`

```typescript
// Current: Loads drivers from driver_connections (wrong table)
// Fixed: Load from drivers table filtered by admin's connection code

const fetchDrivers = async () => {
  // Get admin's connection codes
  const { data: devices } = await supabase
    .from('devices')
    .select('connection_code')
    .eq('user_id', user.id);
  
  const adminCodes = devices?.map(d => d.connection_code).filter(Boolean);
  
  // Get drivers connected with these codes
  const { data: drivers } = await supabase
    .from('drivers')
    .select('driver_id, driver_name, status, last_seen_at')
    .in('admin_code', adminCodes)
    .eq('status', 'active');
  
  setDrivers(drivers);
};
```

#### B. Update Task Creation

```typescript
// When creating task, set assigned_driver_id instead of assigned_user_id
const createTask = async (taskData) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: taskData.title,
      description: taskData.description,
      assigned_driver_id: taskData.driverId,  // From drivers table
      admin_code: adminConnectionCode,
      created_by: user.id,
      // ... other fields
    });
};
```

### 3.4 Rocket Mobile App Requirements

#### A. Tasks Screen

```kotlin
// UI Requirements:
// - List of assigned tasks sorted by due date
// - Task status indicators (Assigned, In Progress, Completed)
// - Pull-to-refresh
// - Task detail view with pickup/dropoff info
// - Navigation to pickup/dropoff locations

class TasksScreen : Fragment() {
    fun loadTasks() {
        api.getTasks(driverId, adminCode, "assigned")
    }
    
    fun acceptTask(taskId: String) {
        api.updateTaskStatus(taskId, "in_progress")
    }
}
```

#### B. Task Completion (Proof of Delivery)

```kotlin
// POD Requirements:
// - Capture receiver name
// - Capture receiver phone
// - Signature capture
// - Photo capture
// - GPS location verification
// - Optional notes

class CompleteTaskScreen : Fragment() {
    private lateinit var signaturePad: SignaturePad
    private var capturedPhoto: Bitmap? = null
    
    fun submitCompletion() {
        val data = TaskCompletionData(
            taskId = task.id,
            receiverName = receiverNameInput.text,
            receiverPhone = receiverPhoneInput.text,
            signature = signaturePad.getSignatureBitmap().toBase64(),
            photo = capturedPhoto?.toBase64(),
            latitude = currentLocation.latitude,
            longitude = currentLocation.longitude,
            note = noteInput.text
        )
        api.completeTask(data)
    }
}
```

#### C. API Calls

**1. List Tasks:**
```http
POST https://invbnyxieoyohahqhbir.supabase.co/functions/v1/driver-tasks
Content-Type: application/json

{
  "action": "list",
  "driverId": "driver_unique_id",
  "adminCode": "ABC12345"
}
```

**2. Accept Task:**
```http
POST https://invbnyxieoyohahqhbir.supabase.co/functions/v1/driver-tasks
Content-Type: application/json

{
  "action": "accept",
  "driverId": "driver_unique_id",
  "taskId": "task_uuid"
}
```

**3. Complete Task:**
```http
POST https://invbnyxieoyohahqhbir.supabase.co/functions/v1/driver-tasks
Content-Type: application/json

{
  "action": "complete",
  "driverId": "driver_unique_id",
  "taskId": "task_uuid",
  "latitude": 9.0820,
  "longitude": 8.6753,
  "receiverName": "John Doe",
  "receiverPhone": "08012345678",
  "signatureBase64": "...",
  "photoBase64": "...",
  "note": "Delivered to reception"
}
```

### 3.5 Acceptance Criteria

- [ ] Admin can create task and assign to mobile driver
- [ ] Driver dropdown shows only drivers connected with admin's code
- [ ] Task appears in driver's mobile app immediately
- [ ] Driver can view task details (pickup, dropoff, description)
- [ ] Driver can accept/reject task
- [ ] Driver can mark task in progress
- [ ] Driver can complete task with POD (signature, photo, receiver info)
- [ ] Admin sees task status updates in real-time
- [ ] Admin can view completed task reports

---

## Implementation Order

### Week 1: Location Tracking
1. [ ] Update `connect-driver` edge function
2. [ ] Update web app to show stale indicators
3. [ ] Provide Rocket app implementation guide
4. [ ] Test end-to-end location flow

### Week 2: SOS System
1. [ ] Run database migration for sos_events
2. [ ] Create `create-sos` edge function
3. [ ] Update web app SOS notifications
4. [ ] Provide Rocket app SOS implementation guide
5. [ ] Test end-to-end SOS flow

### Week 3: Task Assignment
1. [ ] Run database migration for tasks
2. [ ] Update `CreateTask.tsx` to load correct drivers
3. [ ] Create `driver-tasks` edge function
4. [ ] Provide Rocket app tasks implementation guide
5. [ ] Test end-to-end task flow

---

## API Reference Summary

### Edge Function Endpoints

| Function | Purpose | Auth Required |
|----------|---------|---------------|
| `connect-driver` | Driver connection & location | No (uses driver_id + admin_code) |
| `create-sos` | SOS creation & updates | No (uses driver_id + admin_code) |
| `driver-tasks` | Task management | No (uses driver_id + admin_code) |

### Common Request Headers

```http
Content-Type: application/json
```

### Common Error Response

```json
{
  "success": false,
  "error": "Error message",
  "requiresRelogin": true  // Only if driver was deleted
}
```

---

## Testing Checklist

### Location Tracking Tests
- [ ] Driver connects with code
- [ ] Driver location appears on map within 30 seconds
- [ ] Driver status shows "active" when updates are recent
- [ ] Driver status shows "offline" after 5+ minutes without update
- [ ] Location history trail appears correctly
- [ ] Background tracking continues when app is minimized
- [ ] Tracking resumes after phone restart

### SOS Tests
- [ ] Driver triggers SOS with 3-second hold
- [ ] Admin receives notification within 5 seconds
- [ ] SOS appears on ops/incidents page
- [ ] Admin can acknowledge SOS
- [ ] Driver position updates during active SOS
- [ ] Admin can resolve SOS with notes
- [ ] Driver can cancel open SOS

### Task Tests
- [ ] Admin creates task for mobile driver
- [ ] Task appears in driver's app
- [ ] Driver can accept task
- [ ] Driver can complete with POD
- [ ] Admin sees completion report
- [ ] Photos and signature are saved correctly
