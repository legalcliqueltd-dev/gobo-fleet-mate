

## Plan: Fix "Invalid time value" bug in check-subscription

### Problem
The `check-subscription` edge function throws `"Invalid time value"` when `profile.subscription_end_at` contains an unparseable date string. Line 83 does `new Date(profile.subscription_end_at)` without validation.

### Fix
Add a safe date parsing helper in `check-subscription/index.ts` that validates dates before constructing `Date` objects. If `subscription_end_at` is invalid, treat the subscription as inactive and fall through to trial/expired logic.

### Changes
**File: `supabase/functions/check-subscription/index.ts`**
- Wrap `new Date(profile.subscription_end_at)` in a try/catch or validate with `isNaN()` check
- If invalid, log a warning and skip the "active subscription" block
- Same safeguard for `trialStartedAt` parsing on line 73

This is a single-file fix in the edge function.

