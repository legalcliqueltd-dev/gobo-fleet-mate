

## Plan: Update Basic Plan Driver Limit from 3 to 2

### Current State
- The `check_driver_limit` function defaults to 1 for free tier
- The `admin_subscriptions` table has `driver_limit` defaulting to 1
- The `handle_new_admin` function creates subscriptions with `driver_limit: 3` for new admins
- The Pricing component and DriversManagement page reference these limits

### Changes Required

1. **Database migration** — Update the `handle_new_admin` function to set `driver_limit: 2` instead of 3 for new admin subscriptions (basic/free tier)

2. **Update existing subscriptions** — Set `driver_limit = 2` for all current `plan_name = 'free'` subscriptions that have `driver_limit = 3`

3. **Update Pricing component** — Change the Basic plan feature text from "Up to 3 drivers" to "Up to 2 drivers"

4. **Update DriversManagement page** — Verify limit messaging is dynamic (it already reads from `subscription.driver_limit`, so no code change needed there)

### Files to Modify
- `supabase/functions/check-subscription/index.ts` — verify basic plan returns correct limit
- `src/components/Pricing.tsx` — update displayed driver count
- Database migration for `handle_new_admin` function and existing data

