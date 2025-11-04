# Mobile Packaging — Capacitor (Android)

## Why Capacitor

Reuse the web app as a native shell. No code rewrites needed.

## Install Once (Locally)

```bash
npm i -D @capacitor/cli
npm i @capacitor/core @capacitor/android
npx cap init
```

When prompted:
- App name: **gobo-fleet-mate**
- Package ID: **app.lovable.d78756af7da0400ebb464b099b10699b**
- Web directory: **dist**

## Build with Production Env

1. **Create `.env.production`** from template and fill keys:
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your Mapbox token
   ```

2. **Build the web app**:
   ```bash
   npm run build
   ```

3. **Add Android platform** (first time only):
   ```bash
   npx cap add android
   ```

4. **Sync web assets to native**:
   ```bash
   npx cap sync
   ```

5. **Open Android Studio**:
   ```bash
   npx cap open android
   ```

## Android Studio

1. **Run on emulator/device**:
   - Click green play button in Android Studio
   - Select emulator or connected device

2. **Before Play Store release**:
   - Set `versionCode` and `versionName` in `android/app/build.gradle`
   - Configure **App Signing** in Google Play Console
   - Generate **release bundle** (AAB file)

## Development Mode

The `capacitor.config.ts` is pre-configured with hot-reload pointing to Lovable sandbox:
- URL: `https://d78756af-7da0-400e-bb46-4b099b10699b.lovableproject.com`
- Changes in Lovable will reflect immediately in your mobile device/emulator

**For production builds**, remove the `server` section from `capacitor.config.ts`:
```typescript
// Remove this for production:
server: {
  url: 'https://d78756af-7da0-400e-bb46-4b099b10699b.lovableproject.com?forceHideBadge=true',
  cleartext: true
}
```

## Mapbox

- Token is embedded at build time via `VITE_MAPBOX_TOKEN` in `.env.production`
- Internet permission is enabled by default in `AndroidManifest.xml`

## iOS (Optional)

```bash
npm i @capacitor/ios
npx cap add ios
npx cap open ios
```

Configure signing in Xcode and run on device/simulator.

## Troubleshooting

### White screen on device
- Ensure you built (`dist` exists): `npm run build`
- Run `npx cap copy` to sync assets

### Map not showing
- Confirm token present in `.env.production`
- Rebuild: `npm run build && npx cap sync`

### Changes not reflecting
- After code changes, rebuild and sync:
  ```bash
  npm run build
  npx cap sync
  ```

## Useful Scripts

Add these to your `package.json`:
```json
{
  "scripts": {
    "cap:sync": "capacitor sync",
    "cap:copy": "capacitor copy",
    "cap:open:android": "capacitor open android",
    "cap:run:android": "capacitor run android"
  }
}
```
