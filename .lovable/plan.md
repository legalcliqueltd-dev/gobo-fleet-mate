

# Fix Email Domain + Spam Issues

## Problem 1: Wrong Domain in Email Links
All 6 edge functions hardcode `APP_URL = 'https://gobo-fleet-mate.lovable.app'` — every link in every email (Upgrade Now, View Dashboard, etc.) points to the Lovable preview URL instead of your custom domain.

**Fix:** Change `APP_URL` to `'https://fleettrackmate.com'` in all edge functions.

## Problem 2: Emails Landing in Spam
Several factors are causing spam classification:
- Emoji in subject lines (e.g. `🔒 Your FleetTrackMate trial has expired`)
- No `List-Unsubscribe` header (required by Gmail bulk sender guidelines)

**Fix:**
- Remove emoji from all email subject lines
- Add `List-Unsubscribe` header to Resend API calls

## Files to Update

| File | Change |
|------|--------|
| `supabase/functions/bulk-email/index.ts` | Update `APP_URL`, remove emoji from subjects, add unsubscribe header |
| `supabase/functions/geofence-email/index.ts` | Update `APP_URL` |
| `supabase/functions/connect-driver/index.ts` | Update `APP_URL` |
| `supabase/functions/sos-dispatch/index.ts` | Update `APP_URL` |
| `supabase/functions/notify-inactivity/index.ts` | Update `APP_URL` |
| `supabase/functions/trial-reminder/index.ts` | Update `APP_URL` |
| `supabase/functions/create-paystack-checkout/index.ts` | Update fallback origin URL |

## Specific Changes

### All edge functions
```
// Before
const APP_URL = 'https://gobo-fleet-mate.lovable.app';

// After
const APP_URL = 'https://fleettrackmate.com';
```

### bulk-email subject lines
```
// Before
subject = '🔒 Your FleetTrackMate trial has expired';
subject = '📢 Update from FleetTrackMate';

// After
subject = 'Your FleetTrackMate trial has expired';
subject = 'Update from FleetTrackMate';
```

### Email sending (bulk-email + all sendEmail functions)
Add `List-Unsubscribe` header to Resend API payload:
```javascript
headers: { 'List-Unsubscribe': '<https://fleettrackmate.com/settings>' }
```

### create-paystack-checkout fallback origin
```
// Before
const origin = req.headers.get("origin") || "https://gobo-fleet-mate.lovable.app";

// After
const origin = req.headers.get("origin") || "https://fleettrackmate.com";
```

## After Deployment
All 7 edge functions will be redeployed. Email links will point to `fleettrackmate.com` and spam score should improve significantly.
