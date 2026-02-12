

## Fix 5 Driver App Issues

### Issue 1: SOS Photo Not Uploading

**Root Cause:** The `sos-evidence` storage bucket is **private** and requires `auth.role() = 'authenticated'` for INSERT. The driver app has **no Supabase Auth session** (code-based drivers), so the upload at line 106 of `DriverAppSOS.tsx` fails silently.

**Fix:** Move SOS photo upload to the `connect-driver` edge function (which uses the service role). The driver app will send the photo as base64 or a FormData blob to the edge function, which uploads it to storage and updates the `sos_events.photo_url` column.

Alternatively (simpler): Add an **anonymous INSERT policy** on the `sos-evidence` storage bucket so unauthenticated drivers can upload. Then the existing client-side upload code works.

**Chosen approach:** Add a permissive storage policy for `sos-evidence` INSERT that allows any upload (the bucket is already private for reads, and admin-only for viewing). This is the simplest fix and matches how `proofs` already has `proofs_insert_authenticated` allowing any bucket insert.

Also fix line 172: after uploading the photo, the code calls `supabase.from('sos_events').update(...)` directly -- this also fails because `sos_update_admin` RLS only allows admins. Fix: move the photo_url update into the `sos-create` edge function or add a new action to `connect-driver`.

**Files:**
- SQL migration: Add storage policy for anonymous SOS evidence uploads + fix `sos_events` photo update
- `src/pages/app/DriverAppSOS.tsx`: Upload photo via edge function instead of direct Supabase client

---

### Issue 2: Task Completion Not Reaching Admin

**Root Cause:** The `proofs` bucket has the old policy `"Users can upload their own proofs"` requiring `auth.uid()::text = (storage.foldername(name))[1]`. The driver app has no `auth.uid()`, so folder path `{driverId}/...` does not match. There IS a newer policy `proofs_insert_authenticated` that allows any insert to `proofs` bucket -- BUT the driver has no auth session at all (anonymous), so even `bucket_id = 'proofs'` requires at least being authenticated.

The `submit-task-report` edge function action works (it uses service role), but the **media upload happens client-side** at line 156 of `DriverAppCompleteTask.tsx` before the edge function call. This client-side upload fails because the driver has no auth session.

**Fix:** Move file uploads to the edge function, OR add a permissive anonymous upload policy for the `proofs` bucket. Simplest: add an INSERT policy allowing anonymous uploads to `proofs` bucket (reads are already public via `proofs_select_public`).

**Files:**
- SQL migration: Add storage policy allowing anonymous uploads to `proofs` bucket

---

### Issue 3: Offline Trail Not Syncing to Admin Dashboard (Priority 1)

**Root Cause:** The local trail stored in `localStorage` under `driver_location_trail` is **only used for the driver's own map UI**. It is never uploaded to the backend. The admin dashboard reads from `driver_location_history` table, which is populated by the `connect-driver` edge function's `update-location` action.

When the driver is offline:
- On **web**: The `OfflineQueue` component queues location updates and syncs them when online -- this should work but relies on JavaScript running.
- On **iOS native**: The Transistorsoft plugin's native HTTP service is configured to auto-sync -- this handles offline persistence natively.

The real problem is that the **admin dashboard trail/history view** may not be fetching `driver_location_history` correctly, or the data isn't being stored because of accuracy filtering (only locations with accuracy <= 30m are stored).

**Fix:**
1. Verify the admin DriverDetails page correctly queries `driver_location_history` for the trail
2. Ensure the iOS native plugin's `autoSync` configuration is correctly sending offline-queued locations
3. Lower accuracy threshold or store all locations with an `is_accurate` flag so trail continuity is maintained
4. Add a "sync trail" action to the `connect-driver` edge function that accepts a batch of trail points from localStorage

**Files:**
- `supabase/functions/connect-driver/index.ts`: Add a `sync-trail` action that accepts an array of trail points
- `src/pages/app/DriverAppDashboard.tsx`: On reconnect/visibility change, upload any stored trail points via edge function
- `src/pages/admin/DriverDetails.tsx` or equivalent: Verify trail query

Let me check the admin driver details page:

---

### Issue 4: Driver App Dark Theme

**Root Cause:** The app already has a `ThemeProvider` and `ThemeToggle` component wrapping the entire app (including driver routes). The `dark` class toggle works. However, the driver Settings page does not include a theme toggle.

**Fix:** Add the `ThemeToggle` component to the driver app Settings page.

**Files:**
- `src/pages/app/DriverAppSettings.tsx`: Import and render `ThemeToggle`

---

### Issue 5: Driver Shows Active on Mobile but Offline on Admin

**Root Cause:** The driver app updates `drivers.last_seen_at` via the `update-location` action. The admin dashboard considers a driver "online" if `last_seen_at` is within 5 minutes. If location updates stop (due to backgrounding, accuracy filtering, or network issues), the heartbeat stops and the driver appears offline on admin even though the driver app UI still shows "Tracking Active" from a stale state.

**Fix:**
1. Add a dedicated **heartbeat interval** in the driver dashboard that sends a lightweight `update-status` call every 60 seconds, independent of location updates. This ensures `last_seen_at` stays current even when GPS accuracy is poor or locations are being filtered.
2. On the driver app, if the last successful server response was more than 2 minutes ago, show a warning instead of "Tracking Active".

**Files:**
- `src/pages/app/DriverAppDashboard.tsx`: Add heartbeat interval calling `update-status` every 60s
- `src/components/driver/DriverStatusCard.tsx`: Show stale warning if lastSync > 2 min

---

### Implementation Steps

#### Step 1: SQL Migration -- Fix Storage Policies
Add anonymous upload policies for `sos-evidence` and `proofs` buckets so code-based drivers can upload files.

```sql
-- Allow anonymous uploads to sos-evidence bucket
CREATE POLICY "anon_upload_sos_evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'sos-evidence');

-- Allow anonymous uploads to proofs bucket (drop conflicting old policy)
DROP POLICY IF EXISTS "Users can upload their own proofs" ON storage.objects;
CREATE POLICY "anon_upload_proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'proofs');
```

#### Step 2: Fix SOS Photo Upload Flow
Update `DriverAppSOS.tsx`:
- After creating SOS via `sos-create` edge function, upload photo to storage (now works with permissive policy)
- Update `sos_events.photo_url` via a new `connect-driver` action `update-sos-photo` (bypasses RLS)

Add `update-sos-photo` action to `connect-driver` edge function.

#### Step 3: Fix Heartbeat for Driver Online Status
Add a 60-second heartbeat in `DriverAppDashboard.tsx` that calls `update-status` even when no location is available, keeping `drivers.last_seen_at` fresh.

#### Step 4: Sync Offline Trail to Backend
Add `sync-trail` action to `connect-driver` edge function. On app visibility change or when coming back online, upload trail points from localStorage to `driver_location_history`.

#### Step 5: Add Dark Theme Toggle to Driver Settings
Import `ThemeToggle` in `DriverAppSettings.tsx` and render it in an "Appearance" card.

#### Step 6: Show Stale Tracking Warning
Update `DriverStatusCard.tsx` to show warning if last sync was more than 2 minutes ago.

### Files to Modify
1. **SQL migration** -- storage policies for anonymous uploads
2. `supabase/functions/connect-driver/index.ts` -- add `update-sos-photo` and `sync-trail` actions
3. `src/pages/app/DriverAppSOS.tsx` -- fix photo upload + sos_events update via edge function
4. `src/pages/app/DriverAppDashboard.tsx` -- add 60s heartbeat interval + trail sync on reconnect
5. `src/pages/app/DriverAppSettings.tsx` -- add ThemeToggle
6. `src/components/driver/DriverStatusCard.tsx` -- stale tracking warning

### After Implementation
- **Publish** for web code changes to take effect on the driver app
- SOS photos and task completion proofs will upload successfully
- Driver heartbeat keeps admin dashboard showing correct online/offline status
- Dark theme toggle available in driver Settings
- Offline trail points sync to backend when connectivity returns

