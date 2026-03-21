/**
 * Shared guard for native Geolocation plugin availability.
 * 
 * When the app is loaded from a remote `server.url` inside Capacitor,
 * the native plugin bridge may not be injected. This helper detects
 * that situation before any Geolocation calls are attempted.
 */

import { Capacitor } from '@capacitor/core';
import { detectNativePlatform } from '@/utils/platformDetection';

/**
 * Returns true when the Capacitor Geolocation native plugin is actually
 * available at runtime (i.e., the bridge exists and the plugin is registered).
 */
export function isGeolocationPluginAvailable(): boolean {
  // On web / non-native, we use browser geolocation — no plugin needed
  if (!detectNativePlatform()) {
    return false;
  }

  // Check Capacitor's own plugin registry
  if (Capacitor.isPluginAvailable('Geolocation')) {
    return true;
  }

  // Fallback: check if the bridge object exists on window
  try {
    const cap = (window as any).Capacitor;
    if (cap?.Plugins?.Geolocation) {
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

/**
 * Returns a human-readable reason why geolocation is unavailable,
 * or null if it IS available (native or browser).
 */
export function getGeolocationUnavailableReason(): string | null {
  const isNative = detectNativePlatform();

  if (isNative) {
    if (!isGeolocationPluginAvailable()) {
      return 'The native Geolocation plugin is not available. The app may need to be rebuilt with bundled assets instead of loading from a remote URL. Please rebuild: npm run build → npx cap sync android → reinstall.';
    }
    return null;
  }

  // Browser context
  if (!navigator.geolocation) {
    return 'Geolocation is not supported by this browser.';
  }

  return null;
}
