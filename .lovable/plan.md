
# Soft Paywall: Allow Dashboard Access with Locked Premium Features

## Problem
1. **Paywall blocks everything**: When the trial expires, `ProtectedRoute` renders a full-screen `PaymentWall` overlay, completely blocking dashboard access. Users should still be able to see the dashboard but with premium features locked.
2. **Admin pages bypass paywall**: The `/admin/*` routes use the same `ProtectedRoute`, but the `AdminDashboard` page does not check subscription status at all. When users access it directly (e.g., from a welcome email link), they get full admin functionality without any paywall.

## Solution

### 1. Remove paywall block from ProtectedRoute
- Stop rendering the full-screen `PaymentWall` when subscription is expired
- Let expired users through to the dashboard (they are still authenticated)
- The individual pages/features will handle their own lock state

### 2. Add feature-locking to Dashboard page
- When `hasFullAccess` is false (trial expired, no subscription), show a banner prompting upgrade instead of a full overlay
- Lock premium features (analytics, geofencing, trips, task management) with visual lock indicators and click-to-upgrade prompts
- Keep basic features visible: map view (read-only), driver list (view-only), basic stats

### 3. Add subscription check to AdminDashboard
- Import and check `hasFullAccess` from `useAuth`
- When access is expired, show a non-dismissable upgrade prompt or redirect to dashboard
- Prevent full admin functionality (task creation, driver management, SOS management) for expired users

### 4. Create a reusable LockedFeature wrapper component
- A component that wraps premium sections with a blurred overlay and "Upgrade" button when `hasFullAccess` is false
- Reusable across Dashboard, AdminDashboard, and other protected pages

---

## Technical Details

### File Changes

**`src/components/ProtectedRoute.tsx`**
- Remove the `PaymentWall` rendering for expired subscriptions
- Simply pass children through for authenticated users regardless of subscription status

**`src/components/LockedFeature.tsx`** (new file)
- Props: `children`, `featureName` (string for display)
- When `hasFullAccess` is false: render children with a blurred overlay, lock icon, and "Upgrade to unlock" button that opens PaymentWall
- When true: render children normally

**`src/pages/Dashboard.tsx`**
- Wrap premium sections (analytics cards, geofence alerts, temp tracking manager, add device button) with `LockedFeature`
- Show a persistent upgrade banner at the top when expired
- Keep map and driver list visible but read-only

**`src/pages/admin/AdminDashboard.tsx`**
- Add `useAuth` subscription check
- Wrap the entire admin content with `LockedFeature` or show a prominent upgrade banner
- Block task creation, driver management actions when expired

**Other admin pages** (`TaskList.tsx`, `DriversManagement.tsx`, `CreateTask.tsx`, `Incidents.tsx`)
- Add `hasFullAccess` check with redirect or lock overlay for expired users
