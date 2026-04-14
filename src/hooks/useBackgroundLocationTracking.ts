import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Geolocation } from '@capacitor/geolocation';
import { detectNativePlatform, isIOS, isAndroid } from '@/utils/platformDetection';
import { isGeolocationPluginAvailable } from '@/utils/nativeGeolocation';
import { startAndroidForegroundService, stopAndroidForegroundService } from '@/utils/androidForegroundService';
import {
  addOfflineLocation,
  getPendingBatch,
  removeSyncedLocations,
  getPendingCount,
} from '@/utils/offlineLocationStore';

// Accuracy threshold in meters - only accept high-precision locations
const ACCURACY_THRESHOLD_M = 30;
const MAX_LOW_ACCURACY_COUNT = 2;
// How often to drain the IndexedDB offline queue (ms)
const SYNC_RETRY_INTERVAL_MS = 60_000;
// Max locations per sync-trail batch
const SYNC_BATCH_SIZE = 50;

export interface LocationTrackingOptions {
  updateIntervalMs?: number;
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  batterySavingMode?: boolean;
  driverId?: string;
  adminCode?: string;
}

export const useBackgroundLocationTracking = (
  enabled: boolean = true,
  options: LocationTrackingOptions = {}
) => {
  const {
    updateIntervalMs = 30000,
    enableHighAccuracy = true,
    maximumAge = 5000,
    batterySavingMode = false,
    driverId,
    adminCode,
  } = options;

  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  // Use a single ref to track whether polling/watch is active
  const activeRef = useRef(false);
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchIdRef = useRef<string | number | null>(null);
  const lastSentRef = useRef<number>(0);
  const batteryCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const driverIdRef = useRef<string | undefined>(driverId);
  const adminCodeRef = useRef<string | undefined>(adminCode);
  const lowAccuracyCountRef = useRef<number>(0);
  const isFetchingAccurateRef = useRef<boolean>(false);
  const permissionCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPermissionStateRef = useRef<string>('granted');
  const batteryLevelRef = useRef<number>(100);

  const isNative = detectNativePlatform();
  const isNativeIOS = isNative && isIOS();
  const isNativeAndroid = isNative && isAndroid();
  const useNativePlugin = isNative && isGeolocationPluginAvailable();

  useEffect(() => {
    driverIdRef.current = driverId;
    adminCodeRef.current = adminCode;
  }, [driverId, adminCode]);

  useEffect(() => {
    batteryLevelRef.current = batteryLevel;
  }, [batteryLevel]);

  // ─── Offline persistence helpers ───────────────────────────────
  const storeOffline = useCallback(async (
    latitude: number,
    longitude: number,
    speed: number,
    accuracyM: number,
  ) => {
    const currentDriverId = driverIdRef.current;
    const currentAdminCode = adminCodeRef.current;
    if (!currentDriverId || !currentAdminCode) return;

    await addOfflineLocation({
      driverId: currentDriverId,
      adminCode: currentAdminCode,
      latitude,
      longitude,
      speed,
      accuracy: accuracyM,
      batteryLevel: batteryLevelRef.current,
      timestamp: new Date().toISOString(),
      createdAt: Date.now(),
    });

    // Refresh pending count for UI
    const count = await getPendingCount();
    setPendingOfflineCount(count);
  }, []);

  /** Drain IndexedDB queue via sync-trail */
  const drainOfflineQueue = useCallback(async () => {
    const currentDriverId = driverIdRef.current;
    const currentAdminCode = adminCodeRef.current;
    if (!currentDriverId || !currentAdminCode) return;

    try {
      const batch = await getPendingBatch(SYNC_BATCH_SIZE);
      if (batch.length === 0) return;

      const trailPoints = batch.map(loc => ({
        latitude: loc.latitude,
        longitude: loc.longitude,
        speed: loc.speed,
        accuracy: loc.accuracy,
        batteryLevel: loc.batteryLevel,
        timestamp: loc.timestamp,
      }));

      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'sync-trail',
          driverId: currentDriverId,
          adminCode: currentAdminCode,
          trailPoints,
        },
      });

      if (!error && data?.success) {
        const ids = batch.map(l => l.id!).filter(Boolean);
        await removeSyncedLocations(ids);
        console.log(`[LocationTracking] Synced ${ids.length} offline locations`);
      }
    } catch (err) {
      // Silently fail — will retry on next interval
      console.warn('[LocationTracking] Offline queue drain failed, will retry:', err);
    }

    const count = await getPendingCount();
    setPendingOfflineCount(count);
  }, []);

  // ─── Send a single location update ────────────────────────────
  const sendLocationUpdate = useCallback(async (
    latitude: number,
    longitude: number,
    speed: number | null,
    accuracyM: number
  ) => {
    if (typeof latitude !== 'number' || isNaN(latitude) || typeof longitude !== 'number' || isNaN(longitude)) {
      console.warn('[LocationTracking] Skipping invalid coordinates:', latitude, longitude);
      return;
    }

    const currentDriverId = driverIdRef.current;
    if (!currentDriverId) {
      console.log('No driver ID available for location update');
      return;
    }

    const locationPayload = {
      driverId: currentDriverId,
      latitude,
      longitude,
      speed: speed || 0,
      accuracy: accuracyM,
      batteryLevel: batteryLevelRef.current,
    };

    // Always try to send. If it fails, persist to IndexedDB.
    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: { action: 'update-location', ...locationPayload },
      });

      if (error) throw error;
      if (data?.requiresRelogin) {
        toast.error('Session expired. Please reconnect.');
        return;
      }

      setLastUpdate(new Date());
      setAccuracy(accuracyM);
      lastSentRef.current = Date.now();
    } catch (error) {
      console.error('[LocationTracking] Send failed, storing offline:', error);
      await storeOffline(latitude, longitude, speed || 0, accuracyM);
      setLastUpdate(new Date());
      lastSentRef.current = Date.now();
    }
  }, [storeOffline]);

  // ─── Throttle & accuracy gating ───────────────────────────────
  const getEffectiveInterval = useCallback(() => {
    const bl = batteryLevelRef.current;
    if (batterySavingMode && bl < 20) return Math.max(updateIntervalMs * 3, 60000);
    if (batterySavingMode && bl < 50) return Math.max(updateIntervalMs * 2, 30000);
    return updateIntervalMs;
  }, [batterySavingMode, updateIntervalMs]);

  const handlePositionUpdate = useCallback((
    latitude: number,
    longitude: number,
    speed: number | null,
    accuracyM: number
  ) => {
    const now = Date.now();
    if (now - lastSentRef.current < getEffectiveInterval()) return;

    if (accuracyM > ACCURACY_THRESHOLD_M) {
      lowAccuracyCountRef.current++;
      if (lowAccuracyCountRef.current >= MAX_LOW_ACCURACY_COUNT && !isFetchingAccurateRef.current) {
        requestAccuratePosition();
      }
    } else {
      lowAccuracyCountRef.current = 0;
    }

    const speedKmh = speed !== null ? speed * 3.6 : null;
    sendLocationUpdate(latitude, longitude, speedKmh, accuracyM);
  }, [getEffectiveInterval, sendLocationUpdate]);

  /** Force a high-accuracy GPS fix */
  const requestAccuratePosition = async () => {
    if (isFetchingAccurateRef.current) return;
    isFetchingAccurateRef.current = true;

    try {
      if (useNativePlugin) {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        });
        if (position) {
          const acc = position.coords.accuracy || 0;
          if (acc <= ACCURACY_THRESHOLD_M) {
            lowAccuracyCountRef.current = 0;
            const speedKmh = position.coords.speed !== null ? position.coords.speed * 3.6 : null;
            sendLocationUpdate(position.coords.latitude, position.coords.longitude, speedKmh, acc);
          }
        }
      } else if (!isNativeAndroid && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const acc = position.coords.accuracy;
            if (acc <= ACCURACY_THRESHOLD_M) {
              lowAccuracyCountRef.current = 0;
              const speedKmh = position.coords.speed !== null ? position.coords.speed * 3.6 : null;
              sendLocationUpdate(position.coords.latitude, position.coords.longitude, speedKmh, acc);
            }
          },
          (err) => console.error('[LocationTracking] Fresh GPS fix failed:', err),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
      }
    } catch (error) {
      console.error('[LocationTracking] requestAccuratePosition error:', error);
    } finally {
      isFetchingAccurateRef.current = false;
    }
  };

  // ─── Battery monitoring ───────────────────────────────────────
  const startBatteryMonitoring = async () => {
    const checkBattery = async () => {
      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          setBatteryLevel(Math.round(battery.level * 100));
        }
      } catch { /* Battery API not available */ }
    };
    await checkBattery();
    batteryCheckIntervalRef.current = setInterval(checkBattery, 60000);
  };

  const stopBatteryMonitoring = () => {
    if (batteryCheckIntervalRef.current) {
      clearInterval(batteryCheckIntervalRef.current);
      batteryCheckIntervalRef.current = null;
    }
  };

  // ─── Periodic offline sync retry ──────────────────────────────
  const startSyncRetry = () => {
    // Immediately attempt a drain
    drainOfflineQueue();
    syncRetryIntervalRef.current = setInterval(drainOfflineQueue, SYNC_RETRY_INTERVAL_MS);
  };

  const stopSyncRetry = () => {
    if (syncRetryIntervalRef.current) {
      clearInterval(syncRetryIntervalRef.current);
      syncRetryIntervalRef.current = null;
    }
  };

  // ─── Start / Stop tracking ────────────────────────────────────
  const startTracking = async () => {
    if (activeRef.current) return;

    // On native iOS, skip — useIOSBackgroundTracking handles it
    if (isNativeIOS) {
      console.log('[LocationTracking] Native iOS detected — deferring to useIOSBackgroundTracking');
      setIsTracking(true);
      activeRef.current = true;
      return;
    }

    // On native Android, start the foreground service to keep WebView alive
    if (isNativeAndroid) {
      console.log('[LocationTracking] Starting Android foreground service...');
      await startAndroidForegroundService();
    }

    try {
      if (useNativePlugin) {
        // ─── NATIVE ANDROID: use setInterval polling (more resilient than watchPosition) ───
        const permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted') {
          const requestResult = await Geolocation.requestPermissions();
          if (requestResult.location !== 'granted') {
            toast.error('Location permission denied. Please enable location access in settings.');
            return;
          }
        }

        console.log('[LocationTracking] Starting Capacitor polling (Android)...');

        // Immediate first fix
        try {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
          if (pos) {
            handlePositionUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.accuracy || 0);
          }
        } catch (e) {
          console.warn('[LocationTracking] Initial fix failed:', e);
        }

        // Periodic polling via setInterval — survives WebView suspension better than watchPosition
        pollingIntervalRef.current = setInterval(async () => {
          try {
            const pos = await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 5000,
            });
            if (pos) {
              handlePositionUpdate(pos.coords.latitude, pos.coords.longitude, pos.coords.speed, pos.coords.accuracy || 0);
            }
          } catch (err) {
            console.warn('[LocationTracking] Polling getCurrentPosition error:', err);
          }
        }, getEffectiveInterval());

        activeRef.current = true;
        setIsTracking(true);
      } else if (!isNativeAndroid) {
        // ─── WEB/PWA: browser geolocation watchPosition is fine ───
        if (!navigator.geolocation) {
          toast.error('Geolocation is not supported by this browser.');
          return;
        }

        console.log('[LocationTracking] Using browser geolocation (web/PWA)');
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            handlePositionUpdate(position.coords.latitude, position.coords.longitude, position.coords.speed, position.coords.accuracy);
          },
          (error) => {
            console.error('Location tracking error:', error);
            if (error.code === error.PERMISSION_DENIED) {
              toast.error('Location permission denied. Please enable location access.');
              setIsTracking(false);
            }
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );

        watchIdRef.current = watchId;
        activeRef.current = true;
        setIsTracking(true);
      } else {
        console.error('[LocationTracking] Native Android but Geolocation plugin unavailable.');
        toast.error('Location plugin unavailable. Please reinstall the app.');
      }

      if (batterySavingMode) {
        toast.success('Battery saving mode enabled');
      }
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      toast.error('Failed to start location tracking. Please check permissions.');
    }
  };

  const stopTracking = async () => {
    // Stop polling interval (Android native)
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    // Stop watchPosition (web/PWA)
    if (watchIdRef.current !== null) {
      try {
        if (useNativePlugin) {
          await Geolocation.clearWatch({ id: watchIdRef.current as string });
        } else {
          navigator.geolocation.clearWatch(watchIdRef.current as number);
        }
      } catch (error) {
        console.error('Error stopping location tracking:', error);
      }
      watchIdRef.current = null;
    }

    activeRef.current = false;
    setIsTracking(false);

    if (isNativeAndroid) {
      await stopAndroidForegroundService();
    }
  };

  // ─── Permission monitoring ────────────────────────────────────
  const sendLocationDisabledAlert = async () => {
    const currentDriverId = driverIdRef.current;
    const currentAdminCode = adminCodeRef.current;
    if (!currentDriverId || !currentAdminCode) return;

    console.log('[LocationTracking] Driver disabled location — sending alert to admin');
    try {
      await supabase.functions.invoke('connect-driver', {
        body: { action: 'location-disabled', driverId: currentDriverId, adminCode: currentAdminCode },
      });
    } catch (error) {
      console.error('[LocationTracking] Failed to send location-disabled alert:', error);
    }
  };

  const startPermissionMonitoring = () => {
    if (!useNativePlugin) return;
    permissionCheckIntervalRef.current = setInterval(async () => {
      try {
        const result = await Geolocation.checkPermissions();
        const currentState = result.location;
        if (lastPermissionStateRef.current === 'granted' && currentState !== 'granted') {
          console.log('[LocationTracking] Permission changed from granted to', currentState);
          sendLocationDisabledAlert();
        }
        lastPermissionStateRef.current = currentState;
      } catch (error) {
        console.error('[LocationTracking] Permission check error:', error);
      }
    }, 30000);
  };

  const stopPermissionMonitoring = () => {
    if (permissionCheckIntervalRef.current) {
      clearInterval(permissionCheckIntervalRef.current);
      permissionCheckIntervalRef.current = null;
    }
  };

  // ─── Main effect ──────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) {
      stopTracking();
      stopSyncRetry();
      return;
    }

    startTracking();
    startBatteryMonitoring();
    startPermissionMonitoring();
    startSyncRetry();

    return () => {
      stopTracking();
      stopBatteryMonitoring();
      stopPermissionMonitoring();
      stopSyncRetry();
    };
  }, [enabled, updateIntervalMs, enableHighAccuracy, batterySavingMode]);

  return {
    isTracking,
    lastUpdate,
    batteryLevel,
    accuracy,
    pendingOfflineCount,
    startTracking,
    stopTracking,
    drainOfflineQueue,
  };
};
