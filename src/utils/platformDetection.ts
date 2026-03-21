import { Capacitor } from '@capacitor/core';

/**
 * Robust native platform detection.
 * When the app loads from a remote URL via Capacitor's server.url,
 * Capacitor.isNativePlatform() can return false because the JS runs
 * in a remote web context. We use multiple signals to detect native.
 */
export const detectNativePlatform = (): boolean => {
  try {
    if (Capacitor.isNativePlatform()) return true;
    const platform = Capacitor.getPlatform();
    if (platform === 'android' || platform === 'ios') return true;
    const cap = (window as any).Capacitor;
    if (cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) return true;
    if (cap && cap.platform && cap.platform !== 'web') return true;
    return false;
  } catch {
    return false;
  }
};

export const isAndroid = (): boolean => {
  try {
    return Capacitor.getPlatform() === 'android' || (window as any).Capacitor?.platform === 'android';
  } catch {
    return false;
  }
};

export const isIOS = (): boolean => {
  try {
    return Capacitor.getPlatform() === 'ios' || (window as any).Capacitor?.platform === 'ios';
  } catch {
    return false;
  }
};
