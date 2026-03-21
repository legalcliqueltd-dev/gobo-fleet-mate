import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.fleettrackmate.driver',
  appName: 'FleetTrackMate-Driver',
  webDir: 'dist',
  bundledWebRuntime: false,
  // Android loads from bundled dist/ so native plugins (Geolocation etc.) work.
  // For dev/debug with hot-reload, temporarily uncomment the server block.
  // server: {
  //   url: 'https://fleettrackmate.com/app?forceHideBadge=true',
  //   cleartext: true,
  //   androidScheme: 'https'
  // },
  android: {
    // After syncing, run: powershell -ExecutionPolicy Bypass -File scripts/android-post-sync.ps1
    // to remove Transistorsoft (iOS-only) from the Android build
  },
  plugins: {
    Geolocation: {
      requestAlwaysPermission: true,
    },
  },
};

export default config;
