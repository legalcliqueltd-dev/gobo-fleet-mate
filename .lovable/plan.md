

# Email Notification System Implementation

## Step 0: Add RESEND_API_KEY Secret
Store your Resend API key as a Supabase secret so all edge functions can use it.

## Step 1: Create `send-email` Edge Function
A centralized, reusable email sender that all other functions call internally via the Resend REST API.

- Accepts: `to`, `subject`, `html`, `replyTo`
- From: `FleetTrackMate <noreply@yourdomain.com>` (using your verified domain)
- Clean HTML email template with branding

## Step 2: Update `sos-dispatch` (SOS Emergency Emails)
When an SOS is created:
- Look up admin email via `admin_code` -> `devices.connection_code` -> `devices.user_id` -> `profiles.email`
- Send urgent email: "EMERGENCY: SOS Alert from [Driver]" with hazard, location, and dashboard link

## Step 3: Create `trial-reminder` Edge Function
A cron-callable function that:
- Queries profiles with `subscription_status = 'trial'`
- Sends email at 3 days remaining and on expiration day
- Tracks via new `last_trial_reminder_at` column on `profiles` to avoid duplicates
- Includes upgrade link

## Step 4: Update `notify-inactivity` (Device Offline Emails)
Replace the non-functional FCM logic with Resend email:
- Look up device owner email from `profiles`
- Send: "[Device Name] is offline"
- Keep existing deduplication via `last_notified_offline_at`

## Step 5: Update `connect-driver` (Task Completion + Driver Onboarding Emails)
**Task completed:** After `submit-task-report`, email the task creator: "Task Completed: [Title]"
**New driver connected:** On first `connect` action, email admin: "New Driver Connected: [Name]"

## Step 6: Geofence Breach Emails (Inline in `sos-dispatch` or new function)
Create a lightweight callable for geofence events that emails the geofence creator when entry/exit occurs.

## Database Migration
```sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_trial_reminder_at timestamptz;
```

## Files Created
| File | Purpose |
|------|---------|
| `supabase/functions/send-email/index.ts` | Centralized Resend email helper |
| `supabase/functions/trial-reminder/index.ts` | Trial expiration reminder |
| `supabase/functions/geofence-email/index.ts` | Geofence breach notifications |

## Files Modified
| File | Change |
|------|--------|
| `supabase/config.toml` | Add new function configs |
| `supabase/functions/sos-dispatch/index.ts` | Add admin email on SOS |
| `supabase/functions/notify-inactivity/index.ts` | Replace FCM with Resend |
| `supabase/functions/connect-driver/index.ts` | Add task + onboarding emails |

## Email Templates
All emails use clean inline-styled HTML with:
- FleetTrackMate header
- Clear action button linking to the relevant dashboard page
- "You're receiving this because..." footer

