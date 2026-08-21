import { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for Driver App (iOS/Android)
 * 
 * This configuration is specifically for the driver mobile app.
 * The admin dashboard remains web-only.
 * 
 * Usage:
 * 1. Run: npm run build
 * 2. Run: npm run cap:sync:ios (or npm run cap:sync:android)
 * 3. Run: npx cap open ios (or android)
 * 
 * For production builds, remove the 'server' section to bundle
 * assets locally instead of loading from preview URL.
 */
const config: CapacitorConfig = {
  appId: 'app.fleettrackmate.driver',
  appName: 'FleetTrackMate',
  webDir: 'dist',
  bundledWebRuntime: false,
  includePlugins: [
    '@capacitor/camera',
    '@capacitor/geolocation',
    // Delivers the fleettrackmate:// OAuth callback back into the app
    '@capacitor/app',
    // On-device alerts with their own sound (jobs, stations, SOS)
    '@capacitor/local-notifications',
    // Native Google / Apple sign-in sheets for the manager portal
    '@capgo/capacitor-social-login',
    '@capacitor/haptics',
    '@capacitor/keyboard',
    '@capacitor/status-bar',
    // Keeps tracking alive while the app is backgrounded on Android
    '@capawesome-team/capacitor-android-foreground-service',
    '@transistorsoft/capacitor-background-geolocation',
    '@transistorsoft/capacitor-background-fetch',
  ],

  // IMPORTANT:
  // Keep native builds on bundled local assets.
  // Remote `server.url` loading can make native plugins (especially Geolocation)
  // show up in metadata while still failing at runtime with
  // "plugin is not implemented on android".
  //
  // For temporary UI-only hot reload, uncomment locally, then re-sync with the
  // server block removed before testing native plugins again.
  // server: {
  //   url: 'https://fleettrackmate.com/app?forceHideBadge=true',
  //   cleartext: true,
  //   androidScheme: 'https',
  // },

  // iOS-specific configuration
  ios: {
    // Background location updates
    // Note: Must also enable "Background Modes > Location updates" in Xcode
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
  },

  // Android-specific configuration  
  android: {
    backgroundColor: '#ffffff',
  },

  // Plugins configuration
  plugins: {
    // Geolocation plugin config
    Geolocation: {
      // Request background location permission on iOS
      requestAlwaysPermission: true,
    },

    // Manager sign-in. Facebook and Twitter are switched off so their SDKs are
    // never bundled — that keeps the APK smaller and avoids declaring
    // third-party data collection we do not actually do.
    SocialLogin: {
      providers: {
        google: true,
        apple: true,
        facebook: false,
        twitter: false,
      },
    },
  },
};

export default config;

/**
 * iOS Info.plist entries required (automatically patched by npm run cap:sync:ios):
 * 
 * <key>NSLocationWhenInUseUsageDescription</key>
 * <string>FleetTrackMate needs your location to share your position with your fleet manager.</string>
 * 
 * <key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
 * <string>FleetTrackMate needs continuous location access to track your position even when the app is in the background.</string>
 * 
 * <key>UIBackgroundModes</key>
 * <array>
 *   <string>location</string>
 *   <string>fetch</string>
 *   <string>processing</string>
 * </array>
 *
 * <key>BGTaskSchedulerPermittedIdentifiers</key>
 * <array>
 *   <string>com.transistorsoft.fetch</string>
 *   <string>com.transistorsoft.customtask</string>
 * </array>
 */
