

# iOS Driver App: Code-Only Connection (No Email/Password)

## Summary
The iOS driver app currently requires Supabase email/password login before drivers can connect with their admin code. This needs to be changed so drivers can use the app with just their name and admin code - no email or account required.

## Current Flow (Wrong)
1. Driver opens app
2. Redirected to login page (requires email + password)
3. After login, goes to connect page
4. Enters name + admin code
5. Connected to fleet

## New Flow (Correct)
1. Driver opens app
2. Goes directly to connect page
3. Enters name + admin code
4. Connected to fleet and starts using app immediately

## Changes Required

### 1. Create Driver Session Context
**New File:** `src/contexts/DriverSessionContext.tsx`

- Create a separate context for driver app that doesn't use Supabase auth
- Store `driverId` and `driverName` in localStorage
- Provide functions: `connect`, `disconnect`, `getSession`
- Check if driver is connected on app load

### 2. Create Driver-Only Protected Route
**New File:** `src/components/DriverProtectedRoute.tsx`

- Separate route protection for driver app pages
- Only checks if `driverId` exists in localStorage (not Supabase user)
- Redirects to `/app/connect` if not connected
- Does NOT show PaymentWall (drivers don't pay, admins do)

### 3. Update Driver App Entry Point
**File:** `src/pages/app/DriverApp.tsx`

- Remove `useAuth()` dependency
- Use new `useDriverSession()` context instead
- Check for stored driverId, not Supabase user

### 4. Update Connect Page
**File:** `src/pages/app/DriverAppConnect.tsx`

- Remove `useAuth()` and user checks
- Save `driverId` to localStorage after successful connection
- No login required - just name + code

### 5. Update All Driver App Pages
Files to update:
- `src/pages/app/DriverAppDashboard.tsx`
- `src/pages/app/DriverAppTasks.tsx`
- `src/pages/app/DriverAppSOS.tsx`
- `src/pages/app/DriverAppSettings.tsx`

Changes:
- Replace `useAuth()` with `useDriverSession()`
- Use `driverId` instead of `user.id` for queries
- Remove email display in settings (show driver name instead)

### 6. Update App Routes
**File:** `src/App.tsx`

- Wrap driver app routes with `DriverSessionProvider`
- Replace `ProtectedRoute` with `DriverProtectedRoute` for `/app/*` routes
- Remove login/signup routes for driver app (no longer needed)

### 7. Delete Unused Driver Auth Pages
Files to remove:
- `src/pages/app/DriverAppLogin.tsx`
- `src/pages/app/DriverAppSignup.tsx`

## Technical Details

**Driver Session Storage:**
```text
localStorage:
├── ftm_driver_id: "uuid-string"
├── ftm_driver_name: "John Driver"
└── ftm_admin_code: "BA2BD021"
```

**Edge Function (already works):**
The `connect-driver` function already supports unauthenticated connections with just `code` and `driverName`. No changes needed.

**Key Benefits:**
- Drivers need only name + code to start (no email/password)
- Session persists across app restarts
- Works completely offline for cached data
- Admin payment wall doesn't affect drivers
- Simple reconnection with same code

## Files Summary

| File | Action |
|------|--------|
| `src/contexts/DriverSessionContext.tsx` | CREATE |
| `src/components/DriverProtectedRoute.tsx` | CREATE |
| `src/pages/app/DriverApp.tsx` | MODIFY |
| `src/pages/app/DriverAppConnect.tsx` | MODIFY |
| `src/pages/app/DriverAppDashboard.tsx` | MODIFY |
| `src/pages/app/DriverAppTasks.tsx` | MODIFY |
| `src/pages/app/DriverAppSOS.tsx` | MODIFY |
| `src/pages/app/DriverAppSettings.tsx` | MODIFY |
| `src/App.tsx` | MODIFY |
| `src/pages/app/DriverAppLogin.tsx` | DELETE |
| `src/pages/app/DriverAppSignup.tsx` | DELETE |

