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
    // Exclude Transistorsoft plugins (iOS-only) from Android builds
    includePlugins: [
      '@capacitor/camera',
      '@capacitor/geolocation'
    ]
  }
};

export default config;
