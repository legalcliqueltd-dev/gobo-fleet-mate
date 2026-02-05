
# Implementation Plan: iOS Location, Background Tracking & SOS Notifications

## Overview

This plan addresses three critical issues:
1. **Location accuracy**: iOS driver location showing in wrong city on admin map
2. **Background tracking**: Continuous tracking when device is locked/app closed
3. **SOS admin notifications**: In-app bell + email alerts with location links

---

## Issue 1: Location Accuracy - iOS Driver Shows in Wrong City

### Root Cause Analysis

The iOS app is sending location updates via the `connect-driver` edge function, but there's a disconnect:

1. **Coordinate mismatch**: The iOS app may be sending coordinates from a previous location or simulator default
2. **Accuracy filtering too strict or not working**: The edge function filters locations with accuracy > 1500m, but coordinates could still be cached/stale
3. **Data flow check needed**: Verify the `driver_locations` table is receiving fresh iOS coordinates

### Technical Fix

**A. Add debug logging to verify actual coordinates being sent:**

Update `DriverAppDashboard.tsx` to show coordinates being tracked and synced, plus add a "Last synced" timestamp with actual lat/lng values.

**B. Ensure Capacitor Geolocation returns fresh, accurate positions:**

- Force `maximumAge: 0` to prevent cached positions
- Add GPS accuracy indicator on mobile map
- Only sync locations with accuracy < 100m (per existing memory constraint)

**C. Update connect-driver edge function to log received coordinates:**

Add better logging to trace the exact values being stored.

### Files to Modify
- `src/pages/app/DriverAppDashboard.tsx` - Add coordinate debug display
- `supabase/functions/connect-driver/index.ts` - Improve logging
- `src/hooks/useBackgroundLocationTracking.ts` - Force fresh position, reduce accuracy threshold

---

## Issue 2: Background Tracking on iOS

### Current Limitation

Standard `Geolocation.watchPosition()` stops when:
- The app is backgrounded
- The screen is locked
- The device is powered off

### Solution: Capacitor Background Geolocation Plugin

The recommended approach is to use a dedicated background location plugin:

**Plugin: `@transistorsoft/capacitor-background-geolocation`**

This plugin:
- Continues tracking in background
- Works when screen is locked
- Handles OS-level location persistence
- Auto-restarts on device reboot (with proper configuration)

### Technical Implementation

**A. Install the background geolocation plugin:**
```bash
npm install @transistorsoft/capacitor-background-geolocation
npx cap sync
```

**B. Create a new tracking hook:**
- `src/hooks/useIOSBackgroundTracking.ts`
- Configure for always-on tracking
- Handle battery optimization

**C. Update iOS Info.plist entries (already in post-sync script):**
- `UIBackgroundModes: location`
- `NSLocationAlwaysAndWhenInUseUsageDescription`

**D. Configure in DriverAppDashboard:**
- Replace `useBackgroundLocationTracking` with the native background version when on iOS
- Fall back to browser geolocation on web

### Alternative: Store Last Known Location

Even with background tracking limitations, ensure:
- When the app goes to background/closes, store the LAST known location
- When driver goes offline, the admin dashboard shows "Last known location" with timestamp
- This provides fallback data even if continuous tracking fails

### Files to Create/Modify
- `src/hooks/useIOSBackgroundTracking.ts` (new)
- `src/pages/app/DriverAppDashboard.tsx` - Use native tracking on iOS
- `scripts/ios-post-sync.sh` - Ensure all required plist entries
- `capacitor.config.ts` - Add plugin configuration

---

## Issue 3: SOS Admin Notifications - Email & In-App

### Current State Analysis

1. **SOS Bell**: `SOSNotificationBell.tsx` exists but only shows for users with `admin` role in `user_roles` table
2. **SOS Events**: Currently linked via `user_id` (UUID) which expects auth users, but drivers use `driver_id` (text)
3. **Email notifications**: Edge function `sos-dispatch` exists but isn't triggered and has no email implementation

### Problems Identified

1. **SOS bell not visible**: Admin may not have `admin` role in `user_roles` table
2. **SOS events not linking to driver's admin**: No `admin_code` column in `sos_events` to filter by owner
3. **Email not implemented**: The edge function logs but doesn't send actual emails

### Technical Solution

**A. Fix SOS event creation to include admin_code:**

Update `DriverAppSOS.tsx` to include the driver's `admin_code` when creating SOS events. This links the SOS to the correct admin.

**B. Add admin_code column to sos_events table (SQL migration):**
```sql
ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS admin_code TEXT;
CREATE INDEX IF NOT EXISTS sos_events_admin_code_idx ON public.sos_events(admin_code);
```

**C. Update SOS notifications hook to filter by admin_code:**

Modify `useSOSNotifications.ts` to only show SOS events for drivers connected to the current admin's devices.

**D. Implement email notifications using Resend:**

Since you need a free option, **Brevo (formerly Sendinblue)** offers 300 free emails/day. Alternatively, we can use a simple webhook to an SMTP service.

For email, create an edge function that:
- Triggers when SOS is created
- Looks up the admin's email from their `admin_code` (via devices -> user_id -> profiles)
- Sends email with Google Maps link to exact SOS location

**E. Add "offline alert" system:**

When a driver goes offline (no heartbeat for 5+ minutes):
1. Store their last known location in `driver_location_history`
2. Optionally trigger an email alert to admin
3. Show on dashboard with "Last seen: [location link]"

### Email Content Template
```
Subject: 🚨 SOS Alert from [Driver Name]

[Driver Name] has triggered an emergency SOS alert.

📍 Location: [Google Maps Link]
⏰ Time: [Timestamp]
🚨 Type: [Hazard Type]
💬 Message: [Driver message if any]

Click here to view on dashboard: [Dashboard Link]
```

### Files to Create/Modify
- `src/pages/app/DriverAppSOS.tsx` - Include admin_code in SOS creation
- `src/hooks/useSOSNotifications.ts` - Filter by admin_code
- `supabase/functions/sos-dispatch/index.ts` - Implement Resend email sending
- SQL migration for admin_code column
- `src/components/sos/SOSNotificationBell.tsx` - Ensure visibility for admins

---

## Implementation Priority

### Phase 1: Quick Fixes (High Impact, Low Effort)
1. Add `admin` role to user if missing (SQL)
2. Add admin_code to sos_events and update DriverAppSOS.tsx
3. Fix SOS notifications to filter by admin's drivers

### Phase 2: Location Accuracy
1. Debug coordinate logging in mobile app
2. Force fresh GPS position (maximumAge: 0)
3. Add visible coordinate display for debugging

### Phase 3: Background Tracking
1. Install and configure background geolocation plugin
2. Update iOS post-sync script
3. Test on physical device

### Phase 4: Email Notifications
1. Set up Resend or Brevo account
2. Implement email sending in sos-dispatch
3. Add offline driver alert emails

---

## Email Provider Recommendation: Free Options

| Provider | Free Tier | Best For |
|----------|-----------|----------|
| **Resend** | 3,000/month | Simple API, modern |
| **Brevo** | 300/day | More generous daily limit |
| **Mailgun** | 1,000/month (sandbox) | Established provider |

**Recommendation**: Brevo offers 9,000 free emails/month (300/day) which should cover SOS and offline alerts easily.

---

## Database Changes Required

```sql
-- 1. Add admin_code to sos_events
ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS admin_code TEXT;
CREATE INDEX IF NOT EXISTS sos_events_admin_code_idx ON public.sos_events(admin_code);

-- 2. Grant admin role to your user (replace with your actual user ID)
-- First, find your user ID:
-- SELECT id, email FROM auth.users WHERE email = 'your@email.com';
-- Then:
-- INSERT INTO public.user_roles (user_id, role) VALUES ('YOUR_USER_ID', 'admin');
```

---

## Summary

| Issue | Root Cause | Solution |
|-------|------------|----------|
| Wrong location on map | Stale/cached GPS data | Force fresh position, add debug logging |
| No background tracking | iOS kills app tracking | Use Capacitor background geolocation plugin |
| SOS bell not visible | Admin role missing | Add role to user_roles table |
| SOS not reaching admin | No admin_code linkage | Add admin_code to sos_events |
| No email notifications | Edge function not implemented | Implement Resend/Brevo email sending |
| Offline location lost | No storage on disconnect | Store last location, trigger offline alert |

