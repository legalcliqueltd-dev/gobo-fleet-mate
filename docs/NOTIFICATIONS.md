# Push Notifications (Web) — FCM + Supabase Edge Function

## Prerequisites

1. **Firebase project**: https://console.firebase.google.com
   - Create a Web App in Firebase → copy config values
   - Generate Web Push certificates (VAPID) in Firebase Cloud Messaging → copy VAPID key
2. **Supabase CLI** installed for Edge Functions

## Environment Variables

Add these to your deployment environment (Vercel/Lovable):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_VAPID_KEY=
```

## Service Worker

The app automatically registers `/firebase-messaging-sw.js`.
Web push requires HTTPS (use Vercel preview/production).

## Edge Function Setup

### 1. Create and deploy function

The edge function is located at: `supabase/functions/notify-inactivity/index.ts`

### 2. Set secrets

```bash
supabase secrets set FCM_SERVER_KEY=<your_firebase_server_key>
```

Note: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already configured by Lovable.

### 3. Deploy

```bash
supabase functions deploy notify-inactivity
```

### 4. Schedule (optional)

If you have Supabase Scheduled Functions enabled:

1. Go to Supabase Dashboard → Edge Functions → Schedules → New schedule
2. Name: `notify-inactivity`
3. Cron: `*/5 * * * *` (every 5 minutes)
4. Function: `notify-inactivity`

Or run manually:
```bash
curl -X POST https://invbnyxieoyohahqhbir.supabase.co/functions/v1/notify-inactivity
```

## Testing

1. In app, go to **Settings** → **Enable notifications**
2. Grant browser permission when prompted
3. Force offline status by running in SQL editor:
   ```sql
   UPDATE devices SET status = 'offline' WHERE id = '<device_id>';
   ```
4. Call the function:
   ```bash
   curl -X POST https://invbnyxieoyohahqhbir.supabase.co/functions/v1/notify-inactivity
   ```
5. You should receive a push notification: "Device offline"

## How It Works

1. **Token Storage**: `notification_tokens` table stores FCM tokens with RLS (users manage only their own tokens)
2. **Status Tracking**: `devices.status_changed_at` tracks when status last changed
3. **Deduplication**: `devices.last_notified_offline_at` ensures one notification per offline event
4. **Edge Function**: Scans for newly offline devices and sends FCM notifications
5. **Mobile**: For Capacitor apps, use platform `android`/`ios` with native FCM plugin; store tokens in the same table

## Notes

- Tokens are automatically removed when user disables notifications
- Multiple tokens per user are supported (web + mobile)
- Notifications only sent when device status changes to offline
- Browser must grant notification permission
- HTTPS required for web push
