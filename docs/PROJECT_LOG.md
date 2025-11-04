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

## Next:
- Phase 3: Real-time map with Mapbox and location tracking

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
