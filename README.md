# FleetTrackMate

**Real-time fleet management and vehicle tracking platform**

## Project Overview

FleetTrackMate is a comprehensive fleet management solution built with React, TypeScript, and Supabase. The platform supports multi-role user management (Admin, Fleet Manager, Driver) with real-time vehicle tracking, analytics, and route optimization.

### Key Features (Planned)
- 🚚 Real-time vehicle tracking with Mapbox
- 👥 Multi-role user management (Admin, Fleet Manager, Driver)
- 📊 Advanced analytics and reporting
- 🗺️ Route optimization
- 📱 Mobile app (iOS/Android) via Capacitor
- 🔔 Real-time notifications and alerts
- 🛠️ Maintenance tracking and scheduling

## Phase Progress

- [x] **Phase 1**: Setup & Integration (Current)
  - Route structure (`/` and `/app/*`)
  - Supabase connection
  - Mapbox environment setup
  - Landing page updates
  - Testing infrastructure

- [ ] **Phase 2**: Authentication & User Management
- [ ] **Phase 3**: Dashboard & Fleet Tracking
- [ ] **Phase 4**: Advanced Features
- [ ] **Phase 5**: Analytics & Reporting
- [ ] **Phase 6**: Mobile App (Capacitor)
- [ ] **Phase 7**: Notifications & Real-time Updates
- [ ] **Phase 8**: Testing & Deployment

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Mapbox account

### Installation

1. Clone and install dependencies:
```bash
npm install
```

2. Set up environment variables (see `.env.example`):
```bash
cp .env.example .env
# Edit .env with your credentials
```

3. Start development server:
```bash
npm run dev
```

4. Open http://localhost:8080

### Testing
- Visit `/app/test` for connection diagnostics
- See `docs/testing/PHASE_1_CHECKLIST.md` for full testing guide

## Documentation

- [Phase 1 Setup Guide](docs/PHASE_1_SETUP.md)
- [Testing Checklist](docs/testing/PHASE_1_CHECKLIST.md)

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
