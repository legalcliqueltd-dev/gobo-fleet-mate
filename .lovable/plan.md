
# Payment System Overhaul and Pricing UI Improvement

## What Changes

### 1. Update Basic Plan: Restrict to 3 Driver Connections
- Change Basic plan feature from "1 driver connection" to "Up to 3 driver connections" across all pricing components (`Pricing.tsx`, `PaymentWall.tsx`, `PaymentModal.tsx`)
- This makes Basic more appealing while still differentiating from Pro's unlimited connections

### 2. Improve Pricing Section UI
- Redesign the pricing cards with better visual hierarchy and spacing
- Make the "Start Free Trial" button larger and more prominent (full-width, hero style)
- Make the "Pay Now - Skip Trial" button clearly visible as a secondary action (not hidden as tiny ghost text)
- Add a clear note below the cards: "No payment required for 7-day trial. Payment only affects admin dashboard -- driver app is always free."
- Update subtitle copy: "Try free for 7 days. No credit card required. Upgrade anytime."

### 3. Strengthen Admin Obstruction After Trial Expires
- **ProtectedRoute**: Already blocks with PaymentWall on `expired` -- no change needed
- **Dashboard**: Add blurred overlay with PaymentWall when subscription is expired (defense in depth)
- **AppLayout**: Add a persistent warning banner when trial has 3 or fewer days remaining, with an "Upgrade" button

### 4. Post-Payment: Show Expiration and Restore Access
- Dashboard Billing card already shows renewal date when active -- will enhance to show it more prominently
- Ensure `?payment=success` query param triggers immediate subscription refresh (already implemented)
- When subscription is active, display clear "Active until [date]" message

### 5. Driver App Remains Unaffected
- `DriverProtectedRoute` and `DriverSessionContext` have no subscription checks -- confirmed no changes needed

---

## Technical Details

### Files to Modify

**`src/components/Pricing.tsx`**
- Update Basic plan features: change "1 driver connection" to "Up to 3 driver connections"
- Redesign cards with improved spacing, larger CTA buttons
- Make "Pay Now - Skip Trial" button more visible (outline variant instead of ghost, larger text)
- Add footer note about driver app being free and trial requiring no payment
- Update subtitle text

**`src/components/PaymentWall.tsx`**
- Update Basic plan features to "Up to 3 driver connections"
- Update copy to clarify that only admin dashboard is blocked, driver app still works
- Add bullet list showing what's locked vs what still works

**`src/components/PaymentModal.tsx`**
- Update Basic plan features to "Up to 3 driver connections"

**`src/components/layout/AppLayout.tsx`**
- Add trial expiration warning banner (when 3 or fewer days remain)
- Import `useAuth` (already imported) and read subscription status
- Show a compact top banner with "X days left in trial - Upgrade Now" button

**`src/pages/Dashboard.tsx`**
- Add blurred expired overlay as defense in depth
- Enhance Billing card: larger, more prominent, show expiration date clearly when active
- Show "Active until [date]" with green badge when subscription is paid

**`src/components/ProtectedRoute.tsx`**
- No changes needed -- already blocks on `expired` status

### Obstruction Strategy Summary
1. Primary block: `ProtectedRoute` renders full-screen `PaymentWall` (existing)
2. Secondary: Dashboard expired overlay with blur (new)
3. Warning: AppLayout banner for last 3 days of trial (new)
4. Driver app: Completely unaffected
