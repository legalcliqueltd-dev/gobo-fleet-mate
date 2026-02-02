

# Add PaymentWall to All Protected Routes

## Summary
Currently, the PaymentWall only appears on the Dashboard page. When your trial expires, you won't see the payment wall on other pages like Settings. We need to move the PaymentWall to the ProtectedRoute component so it blocks access to ALL protected pages when the trial expires.

## Current Behavior
- PaymentWall is only rendered inside Dashboard.tsx
- Other pages (Settings, Analytics, Trips, etc.) don't show the payment wall
- Users can still access protected content after trial expires on non-Dashboard pages

## Proposed Solution
Move the subscription check and PaymentWall rendering into `ProtectedRoute.tsx` so it protects all routes uniformly.

## Changes

### 1. Update ProtectedRoute Component
**File:** `src/components/ProtectedRoute.tsx`

- Import `useAuth` to access subscription status
- Import `PaymentWall` component
- Check if `subscription.status === 'expired'` after authentication check
- Render `PaymentWall` instead of children when trial is expired

### 2. Remove Dashboard-specific PaymentWall Logic
**File:** `src/pages/Dashboard.tsx`

- Remove the early return that shows PaymentWall (lines 115-117)
- Keep the trial banner and subscription badge (these are informational, not blocking)

## Technical Details

```text
ProtectedRoute Flow:
┌─────────────────────┐
│     User visits     │
│   protected route   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Auth loading?     │
│        Yes          │───▶ Show loading spinner
└──────────┬──────────┘
           │ No
           ▼
┌─────────────────────┐
│   User logged in?   │
│        No           │───▶ Redirect to login
└──────────┬──────────┘
           │ Yes
           ▼
┌─────────────────────┐
│  Trial expired?     │
│        Yes          │───▶ Show PaymentWall
└──────────┬──────────┘
           │ No
           ▼
┌─────────────────────┐
│   Render children   │
│  (protected page)   │
└─────────────────────┘
```

## Files to Modify
1. `src/components/ProtectedRoute.tsx` - Add subscription check and PaymentWall
2. `src/pages/Dashboard.tsx` - Remove redundant PaymentWall rendering

