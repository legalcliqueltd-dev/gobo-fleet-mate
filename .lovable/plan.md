

# Fix Geofence Console Errors + Marker Deprecation

## Issue 1: Geofence System Broken (404 + Schema Mismatch)

The `geofence_events` table **does not exist** in the database, causing the 404 error. Additionally, the code expects different column names than what the actual `geofences` table has:

| Code expects | DB actually has |
|---|---|
| `user_id` | `created_by` |
| `active` | `is_active` |
| `radius_meters` | `radius_m` |
| `geometry` | `coordinates` |
| `center_lat`, `center_lng` | *(missing)* |

### Database Changes

**1. Add missing columns to `geofences`:**
```sql
ALTER TABLE public.geofences
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision;
```

**2. Create `geofence_events` table:**
```sql
CREATE TABLE public.geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_id uuid NOT NULL REFERENCES public.geofences(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('enter', 'exit')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean NOT NULL DEFAULT false
);

-- RLS
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view geofence events"
  ON public.geofence_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update geofence events"
  ON public.geofence_events FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
```

### Code Changes

**`src/hooks/useGeofences.ts`** - Fix column name mappings:
- Map `active` to `is_active`
- Map `radius_meters` to `radius_m`
- Map `geometry` to `coordinates`
- Use `created_by` instead of `user_id`
- Include `center_lat` and `center_lng` (new columns)

**`src/hooks/useGeofenceEvents.ts`** - Remove `as any` type casts now that the table exists.

**`src/pages/Geofences.tsx`** - Update field references to match the corrected hook types (`is_active` instead of `active`, `radius_m` instead of `radius_meters`, `coordinates` instead of `geometry`).

---

## Issue 2: google.maps.Marker Deprecation Warning

10 files use the legacy `<Marker>` component from `@react-google-maps/api`. Google has deprecated `google.maps.Marker` in favor of `google.maps.marker.AdvancedMarkerElement`.

Since `@react-google-maps/api` doesn't yet have a built-in `AdvancedMarker` wrapper, the fix is to create a reusable `AdvancedMarker` component using `OverlayView` and update all 10 files.

### New file: `src/components/map/AdvancedMarker.tsx`
A wrapper component that uses `OverlayView` from `@react-google-maps/api` to render custom HTML markers, eliminating the deprecation warning.

### Files to update (replace `<Marker>` imports/usage):
1. `src/components/map/DeviceMarker.tsx`
2. `src/components/map/MapView.tsx`
3. `src/components/map/LiveDriverMap.tsx`
4. `src/components/map/DriverLocationMap.tsx`
5. `src/components/map/TaskNavigationMap.tsx`
6. `src/pages/ops/Incidents.tsx`
7. `src/pages/ops/OpsTasks.tsx`
8. `src/pages/admin/CreateTask.tsx`
9. `src/pages/driver/DriverDashboard.tsx`
10. `src/pages/app/DriverAppDashboard.tsx`

Each file will replace `<Marker>` with `<AdvancedMarker>`, keeping existing icon/position/click behavior intact.

---

## Summary

| Task | Scope |
|---|---|
| Create `geofence_events` table + add columns | 1 migration |
| Fix geofence hooks + page (column names) | 3 files |
| Create `AdvancedMarker` component | 1 new file |
| Migrate all `Marker` usages | 10 files |

