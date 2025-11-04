# FleetTrackMate – Project Log

## Phase 1 (App setup)
- ✅ Created Vite + React + TS + Tailwind base with dark mode support.
- ✅ Installed @supabase/supabase-js, react-router-dom, mapbox-gl, react-map-gl, lucide-react.
- ✅ Added basic layout, routes, and HealthCheck component.
- ✅ Configured Supabase client using hardcoded credentials.

## Phase 2 (Auth system)
- ✅ Installed react-hook-form, zod, @hookform/resolvers
- ✅ Created AuthContext with session management and useAuth hook
- ✅ Implemented ProtectedRoute component with redirect support
- ✅ Created auth pages: /auth/login, /auth/signup, /auth/forgot, /auth/update-password
- ✅ Added profiles table with RLS policies
- ✅ Updated AppLayout to show user status and sign out button

## Phase 3 (Dashboard & Map + Realtime)
- ✅ Added devices and locations tables SQL with RLS; enabled realtime on locations
- ✅ Integrated Mapbox map with streets/satellite toggle
- ✅ Fetched user devices and subscribed to realtime locations; latest location per device shown as markers
- ✅ Sidebar lists devices with status (active/idle/offline) based on last timestamp

## Phase 4 (Device management + Details + History)
- ✅ Implemented Device CRUD: add, edit, delete with RLS
- ✅ Dashboard sidebar links to details; "Add Device" button added
- ✅ Device details page shows last known location, stats, and history playback (24h/7d) with animated marker and route line
- ✅ Realtime: devices changes reload list; locations INSERTs update latest position

## Phase 5 (UI polish + branding)
- ✅ Added ThemeProvider and ThemeToggle (light/dark/system) with persisted preference and no-FOUC script
- ✅ Introduced UI primitives (Button, Card) and global CSS utilities for glass/glow
- ✅ Polished header, Landing hero, Dashboard sidebar, and Map controls with glass-morphism and rounded corners
- ✅ Enhanced markers with glow/pulse for active status and soft label bubble
- ✅ Added floating "Add Device" button on mobile

## Phase 6 (Deployment)
- ✅ Added .htaccess for Apache SPA routing (Hostinger)
- ✅ Added /status page to verify Supabase + Mapbox
- ✅ Added Capacitor config and scripts for Android packaging
- ✅ Wrote deployment docs for Hostinger and mobile build

## Phase 7A (AI Insights + Auto Status)
- ✅ Added trigger to set devices.status to active/idle on location inserts; scheduled offline checker (pg_cron) with 15 min threshold
- ✅ Added device_stats RPC to compute distance, avg/max speed, and idle minutes for 24h/7d
- ✅ Added useDeviceInsights hook and Insights panel on Device Details
- ✅ Inactivity hint shows if last update > 10 minutes

## Phase 7B (Fleet Analytics Dashboard)
- ✅ Created fleet analytics dashboard at /analytics route
- ✅ Added fleet_stats RPC to compute aggregated metrics across all user devices
- ✅ Added fleet_utilization_daily RPC to track daily utilization percentages
- ✅ Created useFleetAnalytics hook for fetching fleet-wide data
- ✅ Implemented summary cards: total devices, distance, avg speed, idle time
- ✅ Added pie chart for device status breakdown (active/idle/offline)
- ✅ Added bar chart for daily fleet utilization trends
- ✅ Added navigation links from Dashboard and AppLayout

## Phase 8 (Geofencing Alerts)
- ✅ Created geofences and geofence_events tables with RLS policies
- ✅ Added SQL trigger to automatically detect device entry/exit events
- ✅ Implemented point-in-circle and point-in-polygon detection functions
- ✅ Created geofence management page at /geofences with map drawing tools
- ✅ Added circle and polygon drawing modes on interactive map
- ✅ Implemented real-time geofence event notifications
- ✅ Created floating alert widget on Dashboard with unacknowledged count
- ✅ Added geofence activation/deactivation and delete functionality

## Phase 9 (Trip Detection & History)
- ✅ Created trips table with RLS policies and real-time subscription
- ✅ Added detect_trips() trigger function for automatic trip detection
- ✅ Trip start: device goes from idle (<5 km/h) to moving (≥5 km/h)
- ✅ Trip end: device idle for 5+ minutes after movement
- ✅ Automatic calculation of trip metrics: distance, duration, avg/max speed
- ✅ Created useTrips hook for fetching and filtering trip history
- ✅ Implemented Trips page at /trips with summary stats and filtering
- ✅ Added trip list with device filtering and real-time updates
- ✅ Added navigation links and updated documentation

## Phase 7B (In-App Notifications)
- ✅ Created notification_tokens table with RLS policies for future expansion
- ✅ Added status_changed_at and last_notified_offline_at to devices table
- ✅ Created trigger to track device status changes automatically
- ✅ Implemented in-app toast notifications for geofence events using Supabase Realtime
- ✅ Created Settings page at /settings for notification preferences
- ✅ Created notify-inactivity edge function (available for custom notification logic)
- ✅ Added deduplication logic to prevent spam (last_notified_offline_at)
- ✅ Updated navigation with Settings link (visible when logged in)
- ✅ Removed Firebase to avoid React version conflicts
- ✅ Created comprehensive documentation in docs/NOTIFICATIONS.md
- ✅ In-app notifications work without external dependencies

## Next:
- Phase 10 (optional): Device sharing, data export, maintenance reminders

## Environment variables (Lovable settings)
- Supabase credentials: Hardcoded in src/lib/supabaseClient.ts
- Mapbox token: Configured in src/lib/mapboxConfig.ts

## Important notes:
- Auth system uses email/password with proper validation
- Dashboard route is protected - requires authentication
- Profiles table auto-created via trigger on signup

## Acceptance checklist (what I will verify)
- ✅ The app boots in Lovable preview with no TypeScript or build errors.
- ✅ Landing page renders with the HealthCheck status pill.
- ✅ Navigation works between /, /auth/*, /dashboard.
- ✅ When env vars are set, HealthCheck shows "Supabase connected".
- ✅ Auth flow works: signup → login → dashboard (protected) → logout
