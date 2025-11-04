# In-App Notifications (Supabase Realtime)

## Current Implementation

The app uses **Supabase Realtime** for in-app notifications without requiring external services.

### Features

1. **Geofence Alerts**: Real-time notifications when devices enter/exit geofences
2. **In-App Toast**: Browser toast notifications using `sonner` library
3. **Notification Widget**: Floating bell icon with unacknowledged event count
4. **No External Dependencies**: Works entirely through Supabase

### How It Works

1. **GeofenceAlerts Component** (`src/components/GeofenceAlerts.tsx`):
   - Subscribes to `geofence_events` table via Supabase Realtime
   - Shows toast notification when new events occur
   - Displays floating bell icon with event count
   - Allows users to acknowledge events

2. **Real-time Subscription**:
   ```typescript
   const channel = supabase
     .channel('geofence-events')
     .on('postgres_changes', {
       event: 'INSERT',
       schema: 'public',
       table: 'geofence_events',
     }, () => {
       // Show toast notification
       toast.warning(`Device entered/exited geofence`);
     })
     .subscribe();
   ```

3. **Notification Tokens Table**:
   - Table exists for future push notification integration
   - Currently unused but ready for expansion

## Future Push Notification Options

### Option 1: Supabase Edge Function + Third-Party Service

Use the existing `notify-inactivity` edge function with:
- **SendGrid** for email notifications
- **Twilio** for SMS notifications
- **OneSignal** for web/mobile push (no Firebase needed)

### Option 2: Native Web Push API

Implement browser push notifications without Firebase:
1. Generate VAPID keys server-side
2. Store push subscriptions in `notification_tokens` table
3. Use Web Push Protocol directly from edge function
4. Library: `web-push` (Deno compatible)

### Option 3: Mobile-Only Push

For Capacitor mobile apps:
- Use native push notification plugins
- Platform-specific: FCM for Android, APNs for iOS
- Store tokens in `notification_tokens` table
- Send via Supabase edge function

## Edge Function (notify-inactivity)

The edge function is ready but not actively used:
- Location: `supabase/functions/notify-inactivity/index.ts`
- Purpose: Send notifications when devices go offline
- Can be adapted for email/SMS instead of FCM

### To Enable Email Notifications:

```typescript
// In notify-inactivity/index.ts
const sendEmail = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${Deno.env.get('SENDGRID_API_KEY')}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: userEmail }] }],
    from: { email: 'alerts@fleettrackmate.com' },
    subject: 'Device Offline Alert',
    content: [{ type: 'text/plain', value: `${deviceName} is offline.` }],
  }),
});
```

## Testing In-App Notifications

1. Go to `/geofences` and create a geofence
2. Insert a location that triggers entry/exit
3. Watch Dashboard for toast notification
4. Click bell icon to see event list

```sql
-- Trigger a test event
INSERT INTO public.locations (device_id, latitude, longitude, speed)
VALUES ('YOUR_DEVICE_ID', LAT_INSIDE_GEOFENCE, LNG_INSIDE_GEOFENCE, 5);
```

## Benefits of Current Approach

✅ No external dependencies (Firebase, etc.)  
✅ Works immediately without configuration  
✅ Real-time updates via Supabase  
✅ No VAPID key management  
✅ No browser permission prompts  
✅ Works on all devices (desktop/mobile)  
✅ No version conflicts or bundle size issues  

## Notes

- Firebase was removed due to React version conflicts
- In-app notifications work when app is open
- For background push, implement Option 2 or 3 above
- Edge function remains available for custom notification logic
