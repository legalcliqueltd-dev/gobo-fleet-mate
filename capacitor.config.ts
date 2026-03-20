import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.fleettrackmate.driver',
  appName: 'FleetTrackMate-Driver',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://fleettrackmate.com/app?forceHideBadge=true',
    cleartext: true,
    androidScheme: 'https'
  },
  android: {
    // After syncing, run: powershell -ExecutionPolicy Bypass -File scripts/android-post-sync.ps1
    // to remove Transistorsoft (iOS-only) from the Android build
  }
};

export default config;
