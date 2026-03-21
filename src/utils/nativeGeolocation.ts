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
 * Returns true when ANY geolocation method is available —
 * either the native Capacitor plugin or the browser navigator.geolocation API.
 * Use this to decide whether to block the user vs allow them through.
 */
export function isAnyGeolocationAvailable(): boolean {
  if (isGeolocationPluginAvailable()) return true;
  return typeof navigator !== 'undefined' && !!navigator.geolocation;
}

/**
 * Returns a human-readable reason why geolocation is unavailable,
 * or null if it IS available (native plugin or browser fallback).
 */
export function getGeolocationUnavailableReason(): string | null {
  // If native plugin is available, we're good
  if (isGeolocationPluginAvailable()) return null;

  // If browser geolocation is available, we can use it as fallback
  if (typeof navigator !== 'undefined' && navigator.geolocation) return null;

  // Nothing available at all
  return 'Neither the native Geolocation plugin nor the browser geolocation API is available.';
}
