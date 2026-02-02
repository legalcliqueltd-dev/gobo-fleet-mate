import { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor Configuration for Driver App (iOS/Android)
 * 
 * This configuration is specifically for the driver mobile app.
 * The admin dashboard remains web-only.
 * 
 * Usage:
 * 1. Copy this file to capacitor.config.ts before building
 * 2. Run: npm run build
 * 3. Run: npx cap sync
 * 4. Run: npx cap open ios (or android)
 * 
 * For production builds, remove the 'server' section to bundle
 * assets locally instead of loading from preview URL.
 */
const config: CapacitorConfig = {
  appId: 'app.fleettrackmate.driver',
  appName: 'FleetTrackMate Driver',
  webDir: 'dist',
  bundledWebRuntime: false,
  
  // Production mode - loads from custom domain
  server: {
    url: 'https://fleettrackmate.com/app?forceHideBadge=true',
    cleartext: true,
    androidScheme: 'https',
  },

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
  },
};

export default config;

/**
 * iOS Info.plist entries required (add after running npx cap add ios):
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
 * </array>
 */
