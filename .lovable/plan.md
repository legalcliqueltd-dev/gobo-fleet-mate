
# Implementation Plan: Task Addresses, SOS Notifications & Camera Access

## Overview

This plan addresses three key feature requests:
1. **Task Location by Address**: Replace coordinate inputs with Google Places Autocomplete for address-based location selection
2. **SOS Admin Notifications**: Fix the disconnect between driver SOS events and admin notifications
3. **iOS Camera Access**: Add Capacitor Camera plugin for native camera access in the driver app

---

## 1. Task Location by Address (Google Places Autocomplete)

### Current State
- CreateTask page uses manual latitude/longitude coordinate inputs
- Users can click on a map to set locations
- No address search functionality exists

### Solution
Replace the coordinate-based inputs with Google Places Autocomplete text inputs that:
- Allow typing an address and auto-suggesting matching places
- Automatically convert the selected address to lat/lng coordinates
- Display a formatted address instead of coordinates
- Update map markers when an address is selected

### Technical Changes

**File: `src/pages/admin/CreateTask.tsx`**
- Load the Google Maps `places` library alongside the maps library
- Create a reusable `AddressInput` component using the Places Autocomplete Service
- Replace the latitude/longitude input fields with address text inputs
- Add state for pickup and dropoff addresses
- Add geocoding to convert selected places to coordinates
- Remove the "Click on Map" buttons (per user preference for address-only)
- Keep markers on map to show selected locations visually

**Required Google Maps Library Update:**
```typescript
const { isLoaded } = useJsApiLoader({
  id: 'google-map-script',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  libraries: ['places'], // Add places library
});
```

### Database Impact
- No schema changes required
- Tasks table already stores `pickup_lat`, `pickup_lng`, `dropoff_lat`, `dropoff_lng`

---

## 2. SOS Admin Notifications Fix

### Current State
- Driver app (`DriverAppSOS.tsx`) creates SOS events with `user_id` set to `session?.driverId` (a text string like "john_driver")
- Admin notification hook (`useSOSNotifications.ts`) looks up driver info from `profiles` table using `user_id` as a UUID
- The mismatch causes "Unknown Driver" to appear and potentially missing events

### Root Cause
The mobile driver system uses text-based `driver_id` (from the `drivers` table), but the SOS notification system expects UUID-based `user_id` (from the `profiles` table).

### Solution
Update the notification system to properly fetch driver information from the `drivers` table when the `user_id` is a text-based driver ID.

### Technical Changes

**File: `src/hooks/useSOSNotifications.ts`**
- Update `fetchSOSEvents` to first try looking up driver info from the `drivers` table
- Fall back to `profiles` table for authenticated users
- Add proper type handling for text-based driver IDs

**File: `src/pages/ops/Incidents.tsx`**
- Similar update to the `loadEvents` function
- Ensure driver names are properly resolved from the `drivers` table

### The lookup logic should be:
```text
1. First check if event.user_id matches a driver_id in drivers table
2. If found, use driver_name from drivers table
3. If not found, check profiles table (for authenticated users)
4. Display admin_code alongside driver name for identification
```

---

## 3. iOS Camera Access (Capacitor Camera Plugin)

### Current State
- Driver SOS page uses HTML `<input type="file" capture="environment">` for camera access
- This causes the app to crash/exit on iOS when tapping the camera button
- No Capacitor Camera plugin is installed

### Root Cause
The HTML file input with `capture` attribute doesn't work reliably in Capacitor WebView on iOS. Native camera access requires the Capacitor Camera plugin.

### Solution
Install and integrate the Capacitor Camera plugin for native camera access with proper platform detection.

### Technical Changes

**Package Installation:**
- Add `@capacitor/camera` dependency

**File: `src/pages/Driver.tsx`** (web SOS page)
- Add platform detection using Capacitor
- Use native camera API on iOS/Android
- Fall back to HTML file input on web

**File: `src/pages/app/DriverAppCompleteTask.tsx`** (driver app task completion)
- Same camera integration pattern
- Use Capacitor Camera for photo/video capture on native platforms

**New Utility File: `src/utils/nativeCamera.ts`**
- Create a wrapper function for camera access that handles both platforms
- Encapsulate platform detection logic
- Provide consistent API for image capture

**iOS Configuration Updates (post-sync):**
Update `scripts/ios-post-sync.sh` to include:
- `NSCameraUsageDescription` - Required iOS permission string
- `NSPhotoLibraryUsageDescription` - For gallery access
- `NSPhotoLibraryAddUsageDescription` - For saving photos

### Rebuild Requirements
After these changes, you'll need to:
1. Export to GitHub
2. `git pull && npm install`
3. `rm -rf ios && npx cap add ios && ./scripts/ios-post-sync.sh && npx cap sync ios`
4. `npx cap open ios` → Clean Build (⇧⌘K) → Run (⌘R)

---

## Implementation Order

1. **SOS Notifications Fix** - Highest priority (core functionality broken)
2. **Task Address Input** - UX improvement
3. **Camera Access** - Requires iOS rebuild

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/hooks/useSOSNotifications.ts` | Modify | Fix driver lookup logic |
| `src/pages/ops/Incidents.tsx` | Modify | Fix driver lookup logic |
| `src/pages/admin/CreateTask.tsx` | Modify | Add Places Autocomplete for addresses |
| `src/components/AddressAutocomplete.tsx` | Create | Reusable address input component |
| `src/utils/nativeCamera.ts` | Create | Camera utility with platform detection |
| `src/pages/Driver.tsx` | Modify | Integrate native camera |
| `src/pages/app/DriverAppCompleteTask.tsx` | Modify | Integrate native camera |
| `scripts/ios-post-sync.sh` | Modify | Add camera permission strings |
| `package.json` | Modify | Add @capacitor/camera dependency |

---

## Testing Checklist

After implementation:
- [x] Create a task using address search → verify lat/lng stored correctly
- [x] Trigger SOS from driver app → verify admin sees driver name and notification
- [ ] Test camera button on iOS simulator/device → verify app doesn't crash
- [ ] Upload photo during SOS → verify photo appears in admin incident view

## Implementation Status: ✅ COMPLETE

All code changes have been made. For iOS camera to work, rebuild required:
1. Export to GitHub
2. `git pull && npm install`
3. `rm -rf ios && npx cap add ios && ./scripts/ios-post-sync.sh && npx cap sync ios`
4. `npx cap open ios` → Clean Build (⇧⌘K) → Run (⌘R)
