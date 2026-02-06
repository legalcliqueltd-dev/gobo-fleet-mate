
# Comprehensive Codebase Audit & Improvement Plan

## Executive Summary

After a thorough analysis of the backend, driver app, admin dashboard, and SOS system, I've identified **5 critical issues** and **several UI/UX improvements** needed:

---

## 🚨 Critical Issue #1: SOS Insert Blocked by RLS Policy

### The Problem
Database logs show repeated RLS violations:
```
new row violates row-level security policy for table "sos_events"
```

The current RLS policy for inserting SOS events requires **either**:
- An authenticated user (`auth.uid() IS NOT NULL`) with matching `user_id`, **OR**
- A code-based driver with `auth.uid() IS NULL`

However, **code-based drivers using the driver app ARE authenticated via the anon key**, meaning `auth.uid()` returns a value (the anon key's session), causing the insert to fail.

### The Solution
Create a new edge function `sos-create` that uses the service role to bypass RLS, similar to `connect-driver`. This allows code-based drivers to create SOS events without RLS conflicts.

### Files to Create/Modify
1. **Create**: `supabase/functions/sos-create/index.ts` - New edge function for SOS creation
2. **Modify**: `supabase/config.toml` - Add `[functions.sos-create]` with `verify_jwt = false`
3. **Modify**: `src/pages/app/DriverAppSOS.tsx` - Call edge function instead of direct insert

---

## 🚨 Critical Issue #2: Location Accuracy on Admin Map

### The Problem
The driver location data shows accuracy of **50m** which is above the 30m threshold required for high-precision tracking. Additionally, the last location update was from **December 2025** (2 months old), indicating location syncing is not working correctly.

Looking at `driver_locations` table:
- Driver "John" has accuracy: 50m (above 30m threshold)  
- Location updated: December 1, 2025 (very stale)
- Most drivers have `NULL` location data

### The Solution
1. The iOS background tracking hook already enforces 30m accuracy filtering
2. Need to ensure the web/Android tracking also enforces the 30m threshold
3. Add stale location warnings on the admin map

### Files to Modify
1. **Modify**: `src/hooks/useBackgroundLocationTracking.ts` - Enforce 30m accuracy filter
2. **Modify**: `src/components/map/LiveDriverMap.tsx` - Add stale data indicators

---

## 🚨 Critical Issue #3: iOS Zoom/Pinch Prevention

### The Problem
The `index.html` viewport meta tag doesn't allow users to zoom back out after the UI expands on screen rotation:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

### The Solution
Update the viewport meta tag to allow user scaling:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes" />
```

### Files to Modify
1. **Modify**: `index.html` - Update viewport meta tag

---

## 🚨 Critical Issue #4: SOS-Dispatch Not Triggered

### The Problem
The `sos-dispatch` edge function exists but:
1. It's designed to be triggered by a database webhook that doesn't appear to be configured
2. It's not being called when SOS events are created (because SOS events aren't being created - see Issue #1)
3. Even if called, it only logs notifications rather than sending them

### The Solution
1. After fixing SOS creation (Issue #1), have the `sos-create` function call `sos-dispatch` or inline the notification logic
2. For admin notifications, use the existing Supabase Realtime subscription with audio alerts (already implemented in `useSOSNotifications.ts`)

### Files to Modify
1. **Modify**: `supabase/functions/sos-create/index.ts` - Trigger dispatch after creation

---

## 🚨 Critical Issue #5: Driver Location Not Syncing to Admin Map

### The Problem
The `useBackgroundLocationTracking.ts` hook sends locations to the legacy `locations` table instead of `driver_locations` table. This is why drivers don't appear on the admin map.

Looking at the code:
```typescript
// Current - writes to wrong table!
await supabase.from('locations').insert({...})
```

But the `useIOSBackgroundTracking.ts` correctly uses:
```typescript
// Correct - uses edge function
await supabase.functions.invoke('connect-driver', { body: { action: 'update-location', ... }})
```

### The Solution
Update `useBackgroundLocationTracking.ts` to use the `connect-driver` edge function with `action: 'update-location'` like the iOS hook does.

### Files to Modify
1. **Modify**: `src/hooks/useBackgroundLocationTracking.ts` - Use edge function for location updates

---

## UI/UX Improvements

### Driver App Enhancements
| Improvement | Description |
|-------------|-------------|
| GPS accuracy indicator | Already implemented ✅ |
| Battery saving mode | Already implemented ✅ |
| Trail visualization | Already implemented ✅ |
| Safe area padding | Add safe-area-inset-bottom to nav |

### Admin Dashboard Enhancements
| Improvement | Description |
|-------------|-------------|
| Stale location warning | Add visual indicator when location data is old |
| Driver count badge | Already implemented ✅ |
| Connection status | Already implemented ✅ |

---

## Implementation Plan

### Phase 1: Fix SOS System (Critical)
```
1. supabase/functions/sos-create/index.ts     [NEW]
2. supabase/config.toml                        [ADD sos-create entry]
3. src/pages/app/DriverAppSOS.tsx              [MODIFY - use edge function]
```

### Phase 2: Fix Location Tracking
```
4. src/hooks/useBackgroundLocationTracking.ts  [MODIFY - use connect-driver edge function]
5. index.html                                  [MODIFY - viewport zoom fix]
```

### Phase 3: UI Polish
```
6. src/components/layout/DriverAppLayout.tsx   [MODIFY - add safe area bottom]
```

---

## Technical Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `supabase/functions/sos-create/index.ts` | Edge function to create SOS events using service role |

### Modified Files
| File | Changes |
|------|---------|
| `supabase/config.toml` | Add sos-create function config |
| `src/pages/app/DriverAppSOS.tsx` | Call sos-create edge function |
| `src/hooks/useBackgroundLocationTracking.ts` | Use connect-driver edge function, enforce 30m accuracy |
| `index.html` | Add user-scalable viewport settings |
| `src/components/layout/DriverAppLayout.tsx` | Add safe-area-inset-bottom padding |

---

## Database Status Summary

| Table | Status | Issue |
|-------|--------|-------|
| `sos_events` | Empty | RLS blocking inserts |
| `driver_locations` | 2 records, stale | Web tracking not syncing |
| `drivers` | 6 records | Working correctly |
| `devices` | Working | Connection codes functional |

---

## Post-Implementation Testing

After implementing:
1. **SOS Test**: Initiate SOS from driver app → verify it appears in `/ops/incidents`
2. **Location Test**: Connect driver app → verify real-time location on admin map
3. **Zoom Test**: On iOS, rotate screen and verify pinch-to-zoom works
4. **Accuracy Test**: Verify only locations with ≤30m accuracy are stored
