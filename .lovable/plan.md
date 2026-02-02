
# Update Pricing Plans

## Summary
Update the pricing component to add a 7-day free trial for both plans and change the Pro price to $3.99.

## Changes

### 1. Update Basic Plan
- Add "7 days free trial" badge/indicator
- Add trial info to the features or description
- Update CTA button text to reflect the trial

### 2. Update Pro Plan
- Change price from `$4` to `$3.99`
- Add "7 days free trial" badge/indicator
- Add trial info to the features or description
- Update CTA button text to reflect the trial

### 3. UI Enhancements
- Add a `trial` property to each plan object
- Display a trial badge prominently on each card
- Update the bottom section from "No credit card required" to "7 days free trial" since we're adding trials

## Technical Details

**File to modify:** `src/components/Pricing.tsx`

**Plan data changes:**
```typescript
// Basic plan additions
trial: "7 days free",
cta: "Start Free Trial",

// Pro plan changes  
price: "$3.99",
trial: "7 days free",
cta: "Start Free Trial",
```

**UI additions:**
- Add a trial badge below the price showing "7 days free trial"
- Style the trial text with a subtle highlight color
