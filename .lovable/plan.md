
# Update Capacitor Config to Use Custom Domain

## Overview

Update the Capacitor configuration to point to your custom Hostinger domain (`fleettrackmate.com`) instead of the Lovable preview URL. This will make the driver app load from your production server.

## Changes Required

### 1. Update `capacitor.config.driver.ts`

Change the server URL from the Lovable preview URL to your custom domain:

**Current:**
```typescript
server: {
  url: 'https://d78756af-7da0-400e-bb46-4b099b10699b.lovableproject.com/app?forceHideBadge=true',
  ...
}
```

**Updated:**
```typescript
server: {
  url: 'https://fleettrackmate.com/app?forceHideBadge=true',
  ...
}
```

### 2. Update `capacitor.config.ts` (Main Config)

Also update the main config file so it points to the correct URL by default:

**Updated:**
```typescript
server: {
  url: 'https://fleettrackmate.com/app?forceHideBadge=true',
  cleartext: true,
  androidScheme: 'https'
}
```

## After Approval - Rebuild Steps

Once I make these changes, you'll need to rebuild the iOS app:

```bash
npm run build
npx cap sync ios
npx cap open ios
```

Then build and run in Xcode on your device.

## Prerequisites

Make sure your Hostinger deployment is up-to-date with the latest code (including the driver app routes at `/app`). The app will load directly from `https://fleettrackmate.com/app`.

## Benefits of Using Custom Domain

| Aspect | Custom Domain | Lovable Preview |
|--------|---------------|-----------------|
| Stability | Production-ready | May change |
| Branding | Professional (`fleettrackmate.com`) | Generic |
| Control | You own it | Lovable-managed |
| Speed | Hostinger CDN | Lovable servers |
