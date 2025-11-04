# Phase 1 Setup Documentation

## Overview
Phase 1 establishes the foundation for FleetTrackMate, including:
- Route structure (`/` for landing, `/app/*` for application)
- Supabase integration and health checking
- Mapbox environment setup
- Updated landing page content
- Testing infrastructure

## Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the project root:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_MAPBOX_TOKEN=your_mapbox_token_here
```

**Get your credentials:**
- **Supabase**: https://supabase.com/dashboard → Your Project → Settings → API
- **Mapbox**: https://mapbox.com → Account → Access Tokens

### 3. Start Development Server
```bash
npm run dev
```

App will be available at `http://localhost:8080`

## Route Structure

### Landing Pages (Public)
- `/` - Main landing page with FleetTrackMate branding
- `/404` - Not found page

### Application Routes (Under /app/*)
- `/app/dashboard` - Main dashboard (placeholder)
- `/app/auth/login` - Login page (Phase 2)
- `/app/auth/signup` - Signup page (Phase 2)
- `/app/demo` - Interactive demo (Phase 4)
- `/app/test` - Test simulator (development tool)

## Architecture

### Components
```
src/components/
├── layout/
│   └── AppLayout.tsx       # Main app wrapper with header/nav
├── HealthCheck.tsx          # Supabase/Mapbox status indicator
├── Header.tsx               # Landing page header
├── Hero.tsx                 # Landing hero section
├── Features.tsx             # Features showcase
├── Pricing.tsx              # Pricing plans
└── Footer.tsx               # Footer with HealthCheck
```

### Pages
```
src/pages/
├── Index.tsx                # Landing page
├── NotFound.tsx             # 404 page
└── app/
    ├── AppDashboard.tsx     # Dashboard (placeholder)
    ├── AuthLogin.tsx        # Login (placeholder)
    ├── AuthSignup.tsx       # Signup (placeholder)
    ├── AppDemo.tsx          # Demo (placeholder)
    └── TestSimulator.tsx    # Testing utilities
```

## Key Features

### Health Check Component
Located in the footer on the landing page. Displays:
- ✅ Supabase connection status (connected/error)
- ✅ Mapbox token presence (present/missing)

### Test Simulator (`/app/test`)
Development tool for manual testing:
- Environment variable validation
- Connection status checks
- Quick navigation to all routes
- Phase-by-phase test organization

### AppLayout
Shared layout for authenticated pages:
- Header with logo and navigation
- Responsive sidebar (future)
- Sign out button (placeholder)

## Landing Page Updates

### Hero Section
- Updated CTAs to link to `/app/auth/signup` and `/app/demo`
- Preserved existing design and styling
- Mobile app download buttons ready for Capacitor

### Pricing Plans
Added multi-role features:
- **Starter**: Single user account
- **Professional**: Multi-user roles
- **Enterprise**: Admin, Manager, Driver roles

### Header
- "Sign In" → `/app/auth/login`
- "Get Started" → `/app/auth/signup`

## Testing

### Manual Testing
Follow the checklist: `docs/testing/PHASE_1_CHECKLIST.md`

### Quick Verification
1. Check HealthCheck shows green indicators
2. Navigate to `/app/test` and verify all checks pass
3. Click through all navigation links
4. Test on mobile viewport (375px width)

## Known Limitations

**Phase 1 Scope:**
- ✅ Route structure
- ✅ Environment setup
- ✅ Landing page content
- ✅ Testing infrastructure

**Out of Scope (Coming in Future Phases):**
- ❌ Authentication (Phase 2)
- ❌ Dashboard functionality (Phase 3)
- ❌ Map rendering (Phase 3)
- ❌ Database tables/migrations (Phase 2+)
- ❌ Role-based access control (Phase 2)

## Troubleshooting

### HealthCheck shows "error"
- Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`
- Check Supabase project is active
- Restart dev server after `.env` changes

### HealthCheck shows "missing" for Mapbox
- Verify `VITE_MAPBOX_TOKEN` in `.env`
- Ensure token is a public access token (starts with `pk.`)
- Restart dev server

### Routes not working
- Clear browser cache
- Check for TypeScript errors in console
- Verify `src/App.tsx` routes are correct

### Build errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
npm run dev
```

## Next Steps (Phase 2)

Phase 2 will implement:
- Full authentication (signup, login, password reset)
- User profiles table
- User roles (admin, fleet_manager, driver)
- Protected routes
- Session persistence
- Role-based navigation

## Resources

- [Supabase Docs](https://supabase.com/docs)
- [Mapbox Docs](https://docs.mapbox.com/)
- [React Router](https://reactrouter.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## Support

For issues or questions:
1. Check `docs/testing/PHASE_1_CHECKLIST.md`
2. Review console for errors
3. Verify environment variables
4. Use `/app/test` for diagnostics
