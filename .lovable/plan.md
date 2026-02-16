

# Bulk Email + Trial Expiry Test

## What Gets Built

### 1. New `bulk-email` Edge Function
A new edge function that allows admins to send bulk emails to all users or filtered groups.

- Endpoint: `POST /functions/v1/bulk-email`
- Accepts: `subject`, `html`, `filter` (optional: `all`, `trial`, `expired`, `active`)
- Uses service role to query all matching profiles
- Sends emails in sequence with a small delay to respect Resend rate limits (100/day free tier)
- Returns count of sent/failed emails

### 2. Trigger Trial Expiry Emails Now
Update `trial-reminder` to also accept a `force` parameter that sends expiry emails to ALL expired trial users regardless of deduplication (`last_trial_reminder_at`). This lets you test immediately.

Alternatively, the new `bulk-email` function can be called with `filter: "expired"` and a pre-built template.

## Technical Details

### New File: `supabase/functions/bulk-email/index.ts`

- Authenticates the caller (must be an admin via JWT)
- Queries `profiles` table with service role based on filter:
  - `all` -- all profiles with email
  - `trial` -- `subscription_status = 'trial'`
  - `expired` -- `subscription_status = 'expired'` OR trial expired by date
  - `active` -- `subscription_status = 'active'`
- For `expired` filter, uses the branded trial-expired email template automatically
- Sends via Resend API (same pattern as `send-email`)
- Returns `{ sent: number, failed: number, errors: string[] }`

### Modified: `supabase/config.toml`
Add `bulk-email` function config with `verify_jwt = false` (validates auth in code).

### Testing the System
After deployment, call the function to send trial expiry emails to all expired admins:

```
POST /functions/v1/bulk-email
Authorization: Bearer <your-auth-token>
{ "filter": "expired" }
```

This will:
1. Find all profiles where trial has expired
2. Send each one the "Your trial has expired" email with upgrade link
3. Return how many were sent

## Files

| File | Action |
|------|--------|
| `supabase/functions/bulk-email/index.ts` | Create -- bulk email sender with admin auth |
| `supabase/config.toml` | Add `bulk-email` config |

