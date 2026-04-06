/**
 * Shared guard for native Geolocation plugin availability.
 * 
 * When the app is loaded from a remote `server.url` inside Capacitor,
 * the native plugin bridge may not be injected. This helper detects
 * that situation before any Geolocation calls are attempted.
 */

import { Capacitor } from '@capacitor/core';
import { detectNativePlatform, isAndroid } from '@/utils/platformDetection';

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
 * Returns true when ANY geolocation method is available —
 * either the native Capacitor plugin or the browser navigator.geolocation API.
 * 
 * IMPORTANT: On native Android, browser geolocation is NOT considered a valid
 * fallback because it bypasses the Capacitor permission flow. Only the native
 * plugin counts as "available" on Android.
 */
export function isAnyGeolocationAvailable(): boolean {
  if (isGeolocationPluginAvailable()) return true;

  // On native Android, do NOT fall back to browser geolocation
  if (detectNativePlatform() && isAndroid()) {
    return false;
  }

  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

/**
 * Returns a human-readable reason why geolocation is unavailable,
 * or null if it IS available (native plugin or browser fallback).
 */
export function getGeolocationUnavailableReason(): string | null {
  // If native plugin is available, we're good
  if (isGeolocationPluginAvailable()) return null;

  // On native Android without the plugin, this is a configuration error
  if (detectNativePlatform() && isAndroid()) {
    return 'Native Geolocation plugin is not available. The AndroidManifest.xml may be missing required location permissions, or the plugin was not registered during cap sync. Reinstall the app after running: npm run build && npx cap sync android';
  }

  // If browser geolocation is available, we can use it as fallback (web/PWA only)
  if (typeof navigator !== 'undefined' && navigator.geolocation) return null;

  // Nothing available at all
  return 'Neither the native Geolocation plugin nor the browser geolocation API is available.';
}

/**
 * Returns true when the current platform should use the native Capacitor
 * Geolocation plugin exclusively (no browser fallback).
 */
export function shouldUseNativeOnly(): boolean {
  return detectNativePlatform() && isAndroid() && isGeolocationPluginAvailable();
}
