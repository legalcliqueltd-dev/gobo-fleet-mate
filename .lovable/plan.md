
# Make Driver Details Page a Premium Feature

## What Changes
The Driver Details page (`/driver/:driverId`) will be wrapped with the existing `LockedFeature` component, so expired/unpaid users will see the page content blurred with an "Upgrade to Unlock" prompt -- consistent with how AdminDashboard, TaskList, and other admin pages are already locked.

## Technical Details

**File: `src/pages/DriverDetails.tsx`**
- Import `LockedFeature` from `@/components/LockedFeature`
- Wrap the main content (the returned JSX after the loading/not-found checks) inside `<LockedFeature featureName="Driver Details">`
- The header with the back button and driver name will still be visible but blurred, along with the map, analytics tabs, and action buttons -- prompting the user to upgrade to interact with them
