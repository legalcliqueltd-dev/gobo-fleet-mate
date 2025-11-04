# Phase 1 Testing Checklist

## Environment Setup
- [ ] `.env` file created with all required variables
- [ ] `VITE_SUPABASE_URL` is set
- [ ] `VITE_SUPABASE_ANON_KEY` is set
- [ ] `VITE_MAPBOX_TOKEN` is set

## Build & Boot
- [ ] App builds without errors (`npm run dev`)
- [ ] No TypeScript errors in console
- [ ] No runtime errors on initial load
- [ ] App accessible at `http://localhost:8080`

## Landing Page (/)
- [ ] Page renders correctly
- [ ] FleetTrackMate branding visible
- [ ] Hero section displays with updated content
- [ ] "Start Free Trial" button links to `/app/auth/signup`
- [ ] "View Demo" button links to `/app/demo`
- [ ] Features section displays correctly
- [ ] Pricing section shows updated features (multi-role support)
- [ ] "Get Started" buttons link to `/app/auth/signup`
- [ ] Header "Sign In" links to `/app/auth/login`
- [ ] Header "Get Started" links to `/app/auth/signup`
- [ ] Footer displays correctly
- [ ] HealthCheck component visible in footer
- [ ] HealthCheck shows "Supabase: connected"
- [ ] HealthCheck shows "Mapbox: present"

## Navigation Tests
- [ ] Landing page → Sign In → `/app/auth/login` works
- [ ] Landing page → Get Started → `/app/auth/signup` works
- [ ] Landing page → Start Free Trial → `/app/auth/signup` works
- [ ] Landing page → View Demo → `/app/demo` works
- [ ] Direct navigation to `/app/dashboard` works
- [ ] Direct navigation to `/app/test` works
- [ ] Direct navigation to invalid route shows 404

## App Layout (/app/*)
- [ ] AppLayout header renders on app pages
- [ ] Logo links back to `/app/dashboard`
- [ ] Navigation links visible (Dashboard, Fleet, Drivers, Settings)
- [ ] Sign Out button visible (placeholder)
- [ ] Layout is responsive on mobile

## Auth Pages
- [ ] `/app/auth/login` renders correctly
- [ ] Login page shows "Phase 2" messaging
- [ ] "Sign up" link navigates to `/app/auth/signup`
- [ ] "Back to home" link navigates to `/`
- [ ] `/app/auth/signup` renders correctly
- [ ] Signup page shows "Phase 2" messaging
- [ ] "Sign in" link navigates to `/app/auth/login`
- [ ] Form inputs are disabled with placeholder text

## Dashboard (/app/dashboard)
- [ ] Dashboard renders correctly
- [ ] Stats cards display with placeholder "--" values
- [ ] "Coming in Phase 3" messaging visible
- [ ] Map placeholder displays
- [ ] Layout is responsive

## Demo Page (/app/demo)
- [ ] Demo page renders correctly
- [ ] "Coming soon in Phase 4" messaging visible
- [ ] Demo features list displays
- [ ] Start Demo button is disabled

## Test Simulator (/app/test)
- [ ] Test page renders correctly
- [ ] Supabase connection status shows "connected"
- [ ] Mapbox token status shows "present"
- [ ] Environment variables section shows all vars as "Set"
- [ ] All route navigation buttons work
- [ ] Phase 2-8 cards display as "Coming Soon"

## Responsiveness
- [ ] Mobile view (375px width) - all pages
- [ ] Tablet view (768px width) - all pages
- [ ] Desktop view (1024px+) - all pages
- [ ] Header mobile menu works on small screens
- [ ] AppLayout navigation responsive

## Performance
- [ ] No console errors
- [ ] No console warnings (except expected ones)
- [ ] Page load time < 3 seconds
- [ ] Smooth transitions between pages
- [ ] Images load correctly

## Design System
- [ ] Dark mode works (if theme switcher present)
- [ ] Colors use semantic tokens from theme
- [ ] Glass-morphism effects render correctly
- [ ] Consistent spacing throughout
- [ ] Buttons have proper hover states

## Documentation
- [ ] `README.md` updated with FleetTrackMate info
- [ ] `docs/PHASE_1_SETUP.md` created
- [ ] `.env.example` file exists

## Final Checks
- [ ] All placeholders clearly marked
- [ ] No broken links
- [ ] No missing images
- [ ] TypeScript compilation successful
- [ ] Ready to proceed to Phase 2

---

**Tester Name:** _______________  
**Test Date:** _______________  
**Pass/Fail:** _______________  
**Notes:**
