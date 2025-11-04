# FleetTrackMate

Real-time fleet tracking application built with React, Supabase, and Mapbox.

## Setup

1. **Environment Variables**
   - Set `VITE_MAPBOX_TOKEN` in environment settings
   - Supabase credentials are configured in `src/lib/supabaseClient.ts`

2. **Database Setup**
   - Run `docs/SQL/profiles.sql` in Supabase SQL editor (creates profiles table)
   - Run `docs/SQL/devices_locations.sql` in Supabase SQL editor (creates devices and locations tables)

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

## Project Structure

- `src/pages/Dashboard.tsx` - Main dashboard with map and device list
- `src/components/map/MapView.tsx` - Mapbox map component
- `src/components/dashboard/DeviceSidebar.tsx` - Device list sidebar
- `src/hooks/useRealtimeLocations.ts` - Real-time location subscription hook
- `src/types.ts` - TypeScript type definitions
- `docs/SQL/` - Database migration scripts

## Status Logic

- **Active**: Location updated within last 2 minutes
- **Idle**: Location updated within last 10 minutes
- **Offline**: No location update in over 10 minutes

## Coming Soon

- Advanced analytics and reporting
- Geofencing and alerts
- Driver management

---

## Acceptance Checklist (Phase 5)

- ✅ Header shows theme toggle; switching Light/Dark/System persists after refresh
- ✅ Landing hero, Dashboard sidebar, and Map container use glass effect with rounded corners and soft glow
- ✅ Active device markers pulse; marker labels show name and speed
- ✅ On mobile, the floating "Add Device" button navigates to /devices/new
- ✅ No TypeScript or build errors; existing functionality remains

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
