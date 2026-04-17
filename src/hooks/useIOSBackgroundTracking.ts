import { useEffect, useRef, useState, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  addOfflineLocation,
  getPendingBatch,
  removeSyncedLocations,
  getPendingCount,
} from '@/utils/offlineLocationStore';

// Dynamic import for background geolocation (only available on native)
let BackgroundGeolocation: any = null;

interface BackgroundTrackingOptions {
  updateIntervalMs?: number;
  distanceFilter?: number;
  enableHighAccuracy?: boolean;
  driverId?: string;
  adminCode?: string;
}

interface LocationData {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  heading: number | null;
  timestamp: Date;
}

const SUPABASE_FUNCTIONS_URL = 'https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImludmJueXhpZW95b2hhaHFoYmlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyNTAxMDUsImV4cCI6MjA3NzgyNjEwNX0.bOHyM6iexSMj-EtMoyjMEm92ydF5Yy-J7DHgocn4AKI';

const SYNC_RETRY_INTERVAL_MS = 60_000;
const SYNC_BATCH_SIZE = 50;

export const useIOSBackgroundTracking = (
  enabled: boolean = true,
  options: BackgroundTrackingOptions = {}
) => {
  const {
    updateIntervalMs = 30000,
    driverId,
    adminCode,
  } = options;

  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const isConfiguredRef = useRef(false);
  const hasStartedRef = useRef(false);
  const driverIdRef = useRef<string | undefined>(driverId);
  const adminCodeRef = useRef<string | undefined>(adminCode);
  const syncRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeCountIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [nativePendingCount, setNativePendingCount] = useState(0);

  // Check if we're on native iOS
  const isNativeIOS = Capacitor.getPlatform() === 'ios' && (
    Capacitor.isNativePlatform() || (window as any).Capacitor?.isNativePlatform?.()
  );

  // Resolve effective IDs (props > localStorage cold-start fallback)
  const resolveIds = useCallback(() => {
    const did = driverIdRef.current || localStorage.getItem('ftm_driver_id') || '';
    const code = adminCodeRef.current || localStorage.getItem('ftm_admin_code') || '';
    return { did, code };
  }, []);

  useEffect(() => {
    driverIdRef.current = driverId;
    adminCodeRef.current = adminCode;
  }, [driverId, adminCode]);

  // Push fresh params into Transistorsoft whenever IDs change so native auto-sync
  // POSTs always carry valid driverId/adminCode (root cause #1 of the offline bug).
  useEffect(() => {
    if (!isConfiguredRef.current || !BackgroundGeolocation) return;
    const { did, code } = resolveIds();
    if (!did || !code) return;
    BackgroundGeolocation.setConfig({
      params: {
        action: 'update-location',
        driverId: did,
        adminCode: code,
        isBackground: true,
      },
    }).then(() => {
      console.log('[BackgroundGeolocation] Updated params with driverId=', did);
      // If we deferred start because IDs were missing, start now.
      if (!hasStartedRef.current) {
        startTracking();
      }
    }).catch((e: any) => console.warn('[BackgroundGeolocation] setConfig failed:', e));
  }, [driverId, adminCode, resolveIds]);

  // ─── IndexedDB offline sync (mirrors native SQLite for visibility & extra resilience) ───
  const drainOfflineQueue = useCallback(async () => {
    const { did, code } = resolveIds();
    if (!did || !code) return;

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
          driverId: did,
          adminCode: code,
          trailPoints,
        },
      });

      if (!error && data?.success) {
        const ids = batch.map(l => l.id!).filter(Boolean);
        await removeSyncedLocations(ids);
        console.log(`[iOS-BG] Synced ${ids.length} offline locations from IndexedDB`);
      }
    } catch (err) {
      console.warn('[iOS-BG] Offline queue drain failed, will retry:', err);
    }

    const count = await getPendingCount();
    setPendingOfflineCount(count);
    window.dispatchEvent(new CustomEvent('offline-queue-updated'));
  }, [resolveIds]);

  const startSyncRetry = useCallback(() => {
    drainOfflineQueue();
    syncRetryIntervalRef.current = setInterval(drainOfflineQueue, SYNC_RETRY_INTERVAL_MS);
  }, [drainOfflineQueue]);

  const stopSyncRetry = useCallback(() => {
    if (syncRetryIntervalRef.current) {
      clearInterval(syncRetryIntervalRef.current);
      syncRetryIntervalRef.current = null;
    }
  }, []);

  // Poll Transistorsoft's native SQLite queue count — this is the REAL pending count
  // for offline points (the IndexedDB mirror often stays at 0 because onLocation is
  // suppressed while stationary).
  const pollNativePendingCount = useCallback(async () => {
    if (!BackgroundGeolocation) return 0;
    try {
      const count = await BackgroundGeolocation.getCount();
      setNativePendingCount(typeof count === 'number' ? count : 0);
      return count;
    } catch (e) {
      console.warn('[BackgroundGeolocation] getCount failed:', e);
      return 0;
    }
  }, []);

  const forceNativeSync = useCallback(async () => {
    if (!BackgroundGeolocation) return;
    try {
      const result = await BackgroundGeolocation.sync();
      console.log('[BackgroundGeolocation] sync() flushed', result?.length ?? 0, 'records');
      await pollNativePendingCount();
      await drainOfflineQueue();
      return result;
    } catch (e) {
      console.warn('[BackgroundGeolocation] sync() failed:', e);
    }
  }, [pollNativePendingCount, drainOfflineQueue]);

  useEffect(() => {
    if (!enabled || !isNativeIOS) return;

    initializeBackgroundTracking();
    startSyncRetry();

    // Poll native queue every 5s for live UI updates
    nativeCountIntervalRef.current = setInterval(pollNativePendingCount, 5000);

    return () => {
      stopTracking();
      stopSyncRetry();
      if (nativeCountIntervalRef.current) {
        clearInterval(nativeCountIntervalRef.current);
        nativeCountIntervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isNativeIOS]);

  const initializeBackgroundTracking = async () => {
    try {
      const module = await import('@transistorsoft/capacitor-background-geolocation');
      BackgroundGeolocation = module.default;

      if (!BackgroundGeolocation) {
        console.error('BackgroundGeolocation plugin not available');
        return;
      }

      const { did, code } = resolveIds();

      const state = await BackgroundGeolocation.ready({
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_NAVIGATION,
        distanceFilter: 3,
        stationaryRadius: 5,
        disableMotionActivityUpdates: true,
        stopOnTerminate: false,
        startOnBoot: true,
        stopTimeout: 3,
        activityRecognitionInterval: 5000,
        debug: false,
        logLevel: BackgroundGeolocation.LOG_LEVEL_WARNING,
        preventSuspend: true,
        pausesLocationUpdatesAutomatically: false,
        locationAuthorizationRequest: 'Always',
        showsBackgroundLocationIndicator: true,
        locationUpdateInterval: 10000,
        fastestLocationUpdateInterval: 5000,
        heartbeatInterval: Math.floor(updateIntervalMs / 1000),
        enableHeadless: true,

        // Native HTTP service — persists in native SQLite, auto-syncs.
        // batchSync + threshold 5 prevents a single failure from blocking the queue.
        // maxRecordsToPersist gives us power-off resilience (up to 10k points).
        url: SUPABASE_FUNCTIONS_URL,
        method: 'POST',
        autoSync: true,
        autoSyncThreshold: 5,
        batchSync: true,
        maxBatchSize: 50,
        maxRecordsToPersist: 10000,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        params: {
          action: 'update-location',
          driverId: did,
          adminCode: code,
          isBackground: true,
        },
        // iOS notification config (no-op on iOS, harmless)
        notification: {
          title: 'FleetTrackMate',
          text: 'Tracking your location for your fleet manager',
        },
      });

      console.log('[BackgroundGeolocation] Ready:', state, 'IDs:', { did, code });

      BackgroundGeolocation.onLocation(onLocation, onLocationError);
      BackgroundGeolocation.onMotionChange(onMotionChange);
      BackgroundGeolocation.onProviderChange(onProviderChange);
      BackgroundGeolocation.onHeartbeat(onHeartbeat);

      BackgroundGeolocation.onHttp(async (response: any) => {
        console.log('[BackgroundGeolocation] HTTP response:', response.status, response.responseText?.substring(0, 200));
        if (response.success) {
          setLastUpdate(new Date());
          // Native SQLite confirmed delivery — drain our IndexedDB mirror too.
          drainOfflineQueue();
        } else {
          // Failure: leave IndexedDB copy in place; the JS retry interval will flush it.
          console.warn('[BackgroundGeolocation] HTTP failed; relying on IndexedDB mirror retry.');
        }
      });

      isConfiguredRef.current = true;

      // Only start if we have valid IDs; otherwise the setConfig effect will start later.
      if (did && code) {
        await startTracking();
      } else {
        console.warn('[BackgroundGeolocation] Deferring start until driverId/adminCode are available.');
      }
    } catch (error) {
      console.error('[BackgroundGeolocation] Init error:', error);
      toast.error('Failed to initialize background location tracking');
    }
  };

  const onLocation = (location: any) => {
    console.log('[BackgroundGeolocation] Location:', location.coords);

    const locationData: LocationData = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: location.coords.speed !== undefined ? location.coords.speed * 3.6 : null,
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      timestamp: new Date(location.timestamp),
    };

    setLastLocation(locationData);
    setLastUpdate(new Date());

    if (location.battery?.level != null) {
      setBatteryLevel(Math.round(location.battery.level * 100));
    }

    // Mirror to IndexedDB so the OfflineQueue UI shows pending count, AND so the JS-side
    // sync retry can flush points even if Transistorsoft's native HTTP is stuck.
    const { did, code } = resolveIds();
    if (did && code) {
      addOfflineLocation({
        driverId: did,
        adminCode: code,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        speed: locationData.speed ?? 0,
        accuracy: location.coords.accuracy ?? 0,
        batteryLevel: location.battery?.level != null ? Math.round(location.battery.level * 100) : 100,
        timestamp: new Date(location.timestamp).toISOString(),
        createdAt: Date.now(),
      }).then(() => {
        getPendingCount().then(c => {
          setPendingOfflineCount(c);
          window.dispatchEvent(new CustomEvent('offline-queue-updated'));
        });
      });
    }
  };

  const onLocationError = (error: any) => {
    console.error('[BackgroundGeolocation] Error:', error);
  };

  const onMotionChange = (event: any) => {
    console.log('[BackgroundGeolocation] Motion change:', event.isMoving ? 'moving' : 'stationary');
  };

  const onProviderChange = (event: any) => {
    console.log('[BackgroundGeolocation] Provider change:', event);
    if (!event.enabled) {
      toast.error('Location services disabled. Please enable to continue tracking.');
    }
  };

  const onHeartbeat = async (event: any) => {
    console.log('[BackgroundGeolocation] Heartbeat:', event);
    if (BackgroundGeolocation) {
      try {
        const location = await BackgroundGeolocation.getCurrentPosition({
          maximumAge: 0,
          timeout: 30000,
          desiredAccuracy: 5,
          samples: 3,
          persist: true,
        });
        onLocation(location);
      } catch (error) {
        console.error('[BackgroundGeolocation] Heartbeat getCurrentPosition error:', error);
      }
    }
  };

  const startTracking = async () => {
    if (!BackgroundGeolocation || !isConfiguredRef.current) {
      console.error('[BackgroundGeolocation] Not configured');
      return;
    }

    try {
      await BackgroundGeolocation.start();
      hasStartedRef.current = true;
      setIsTracking(true);
      console.log('[BackgroundGeolocation] Started');
      toast.success('Background tracking active');
    } catch (error) {
      console.error('[BackgroundGeolocation] Start error:', error);
    }
  };

  const stopTracking = async () => {
    if (!BackgroundGeolocation) return;

    try {
      await BackgroundGeolocation.stop();
      hasStartedRef.current = false;
      setIsTracking(false);
      console.log('[BackgroundGeolocation] Stopped');
    } catch (error) {
      console.error('[BackgroundGeolocation] Stop error:', error);
    }
  };

  return {
    isTracking,
    lastLocation,
    lastUpdate,
    batteryLevel,
    pendingOfflineCount,
    startTracking,
    stopTracking,
    drainOfflineQueue,
    isNativeIOS,
  };
};
