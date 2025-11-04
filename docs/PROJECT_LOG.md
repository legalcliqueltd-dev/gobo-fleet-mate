# FleetTrackMate – Project Log

## Phase 1 (App setup)
- ✅ Created Vite + React + TS + Tailwind base with dark mode support.
- ✅ Installed @supabase/supabase-js, react-router-dom, mapbox-gl, react-map-gl, lucide-react.
- ✅ Added basic layout, routes, and HealthCheck component.
- ✅ Configured Supabase client using env vars.

## Next:
- Phase 2: Implement Supabase Auth (signup, login, reset) with validation and Tailwind styling.

## Environment variables (Lovable settings)
- `VITE_SUPABASE_URL` = your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` = your Supabase anon key
- `VITE_MAPBOX_TOKEN` = your Mapbox public access token

## Important notes:
- Do not implement auth or maps yet; placeholders only.
- Keep styles minimal; full glass-morphism and theming will be in Phase 5.

## Acceptance checklist (what I will verify)
- ✅ The app boots in Lovable preview with no TypeScript or build errors.
- ✅ Landing page renders with the HealthCheck status pill.
- ✅ Navigation works between /, /auth, /dashboard.
- ✅ When env vars are set, HealthCheck shows "Supabase connected".
