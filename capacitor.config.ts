import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.d78756af7da0400ebb464b099b10699b',
  appName: 'gobo-fleet-mate',
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
