# FleetTrackMate

Real-time fleet tracking application built with React, Supabase, and Mapbox.

## Setup

1. **Environment Variables**
   - Set `VITE_MAPBOX_TOKEN` in environment settings
   - Supabase credentials are configured in `src/lib/supabaseClient.ts`

2. **Database Setup**
   - Run `docs/SQL/profiles.sql` in Supabase SQL editor (creates profiles table)
   - Run `docs/SQL/devices_locations.sql` in Supabase SQL editor (creates devices and locations tables)
   - Run `docs/SQL/insights_status.sql` in Supabase SQL editor (creates status automation triggers and functions)
   - Run `docs/SQL/insights_stats.sql` in Supabase SQL editor (creates device insights RPC functions)
   - Run `docs/SQL/fleet_analytics.sql` in Supabase SQL editor (creates fleet analytics RPC functions)
   - Notification tables are created via migrations (notification_tokens, device status tracking)

3. **Supabase Auth Configuration**
   - Set Site URL to your Lovable preview URL (e.g., `https://yourproject.lovable.app`)
   - Add redirect URL: `https://yourproject.lovable.app/**`

## Features

### Authentication (Phase 2)
- Email/password authentication with Supabase Auth
- Protected routes with redirect support
- User profile management
- Password reset flow

### Map & Realtime (Phase 3)
- Interactive Mapbox map with street/satellite views
- Real-time location tracking via Supabase Realtime
- Device status indicators (active/idle/offline)
- Auto-fit bounds to visible markers

### Device Management & History (Phase 4)
- Create, edit, and delete devices
- Device details page with location history
- History playback with 24h/7d time range
- Animated route visualization

### UI & Theming (Phase 5)
- Theme toggle in header (Light/Dark/System) with localStorage persistence
- Glass-morphism utilities: `glass-card`, `soft-shadow`, `bg-radial`
- Enhanced map markers with pulse animation for active devices
- Floating "Add Device" button on mobile
- No FOUC (Flash of Unstyled Content) with early theme script

### Insights & Status (Phase 7A)
- Automatic device status updates based on speed (active ≥ 3 km/h, idle < 3 km/h)
- Scheduled offline checker (marks devices offline after 15 min of inactivity)
- Device-level insights: distance traveled, avg/max speed, idle time
- Inactivity alerts for devices without recent updates
- Time range selection: 24h or 7 days

### Fleet Analytics (Phase 7B)
- Fleet-wide analytics dashboard at `/analytics`
- Aggregated metrics: total distance, avg speed, idle time across all devices
- Device status breakdown with pie chart visualization
- Daily fleet utilization trends with bar charts
- Utilization percentage showing active time vs total potential time

### Geofencing Alerts (Phase 8)
- Create circle and polygon geofences on the map at `/geofences`
- Automatic detection of device entry/exit events via SQL trigger
- Real-time alerts with floating notification widget on Dashboard
- Geofence activation/deactivation and management
- Event acknowledgement and history tracking
- Visual geofence zones displayed on map

### Trip Detection (Phase 9)
- Automatic trip detection based on movement patterns (speed < 5 km/h = idle, ≥ 5 km/h = moving)
- Trip history at `/trips` with start/end locations, duration, and distance
- Real-time trip status updates via Supabase Realtime
- Trip metrics: total distance, duration, average speed, max speed
- Filter trips by device

### Push Notifications (Phase 7B)
- In-app notifications via Supabase Realtime for geofence events
- Settings page at `/settings` for notification preferences
- Toast notifications using `sonner` library
- Edge function `notify-inactivity` available for custom notification logic
- Notification tokens table ready for future push notification expansion
- No external dependencies (Firebase removed to avoid conflicts)

## Project Structure

- `src/pages/Dashboard.tsx` - Main dashboard with map and device list
- `src/pages/FleetAnalytics.tsx` - Fleet analytics dashboard with charts
- `src/pages/Geofences.tsx` - Geofence management with map drawing tools
- `src/pages/Trips.tsx` - Trip history with filtering and metrics
- `src/pages/Settings.tsx` - User settings and notification preferences
- `src/pages/devices/DeviceDetails.tsx` - Device details with insights panel
- `src/components/map/MapView.tsx` - Mapbox map component
- `src/components/GeofenceAlerts.tsx` - Floating alert widget
- `src/hooks/useDeviceInsights.ts` - Device-level insights hook
- `src/hooks/useFleetAnalytics.ts` - Fleet-wide analytics hook
- `src/hooks/useGeofences.ts` - Geofence management hook
- `src/hooks/useGeofenceEvents.ts` - Geofence events and alerts hook
- `src/hooks/useTrips.ts` - Trip detection and history hook
- `supabase/functions/notify-inactivity/` - Edge function for offline alerts
- `docs/SQL/` - Database migration scripts and RPC functions
- `docs/NOTIFICATIONS.md` - In-app notification documentation

## Testing Realtime

To test realtime functionality, run these SQL commands in Supabase:

```sql
-- Create a device (replace user_id with your UUID from auth.users):
insert into public.devices (user_id, name, imei) 
values ('YOUR_USER_ID', 'Truck 12', '123456789012345');

-- Create a location:
insert into public.locations (device_id, latitude, longitude, speed)
values (
  (select id from public.devices where imei = '123456789012345'), 
  37.7749, 
  -122.4194, 
  45
);

-- Update location to test realtime updates:
update public.locations 
set latitude = 37.7849, longitude = -122.4094 
where device_id = (select id from public.devices where imei = '123456789012345');
```

## Status Logic

Device status is automatically updated:
- **Active**: Speed ≥ 3 km/h when location is inserted
- **Idle**: Speed < 3 km/h when location is inserted
- **Offline**: No location update for 15+ minutes (checked every 5 minutes via pg_cron)

To manually trigger offline status check:
```sql
select public.ftm_run_offline_status_check(15);
```

## Testing Insights & Analytics

After running `docs/SQL/insights_status.sql`, `docs/SQL/insights_stats.sql`, and `docs/SQL/fleet_analytics.sql`:

```sql
-- Test device insights (view in Device Details page)
select * from public.device_stats(
  'YOUR_DEVICE_ID'::uuid,
  now() - interval '7 days'
);

-- Test fleet analytics (view in Fleet Analytics page)
select * from public.fleet_stats(now() - interval '7 days');
select * from public.fleet_utilization_daily(7);
```

## Testing Geofencing

After the geofencing migration:

1. **Create a geofence:**
   - Go to `/geofences`
   - Click "Draw Circle" or "Draw Polygon"
   - Click on the map to set center (circle) or add points (polygon)
   - Save with a name

2. **Test entry/exit events:**
   - Insert a location inside a geofence:
   ```sql
   insert into public.locations (device_id, latitude, longitude, speed)
   values (
     'YOUR_DEVICE_ID',
     YOUR_GEOFENCE_CENTER_LAT,
     YOUR_GEOFENCE_CENTER_LNG,
     5
   );
   ```
   - Check for "enter" event in `/geofences` alerts
   - Insert a location outside the geofence to trigger "exit" event

3. **View alerts:**
   - Unacknowledged events appear as floating notifications on Dashboard
   - Click bell icon on Dashboard or in Geofences page to view and acknowledge

## Coming Soon

- Device sharing
- Data export (CSV/PDF)
- Maintenance reminders

---

## Acceptance Checklist (Phase 7B)

- ✅ Fleet Analytics page accessible at `/analytics` with navigation links
- ✅ Summary cards show total devices, distance, avg speed, and idle time
- ✅ Pie chart displays device status breakdown (active/idle/offline)
- ✅ Bar chart shows daily fleet utilization trends
- ✅ Time range toggle (7d/30d) updates all metrics
- ✅ Device Details page shows insights panel with distance, speeds, and idle time
- ✅ Inactivity alert appears when device hasn't updated in 10+ minutes
- ✅ No TypeScript or build errors; RLS policies enforced

---

## Lovable Project Info

**URL**: https://lovable.dev/projects/d78756af-7da0-400e-bb46-4b099b10699b

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/d78756af-7da0-400e-bb46-4b099b10699b) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/d78756af-7da0-400e-bb46-4b099b10699b) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## UI Refresh (Phase 11)

- **Fonts**: Sora (headings) + Inter (body). Configured via `tailwind.config.ts` (`fontFamily.heading` / `fontFamily.sans`).
- **Responsive**:
  - Map container uses `65dvh` on mobile and fills more on desktop (`map-shell` class).
  - Dashboard stacks to 1 column on mobile for better usability.
  - Enhanced tap targets (44px minimum) and focus states for accessibility.
- **Neobrutalist accents**:
  - Added `.nb-card`, `.nb-border`, `.nb-button` utilities in `src/index.css`.
  - Button and Card components support `variant="brutal"` for bold borders + offset shadow.
  - Applied brutal variant to primary CTAs (Landing "Get Started", Dashboard FAB) while keeping glass-morphism for large surfaces like maps.
