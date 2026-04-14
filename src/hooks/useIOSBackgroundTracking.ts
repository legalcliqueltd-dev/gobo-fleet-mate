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
    distanceFilter = 5,
    driverId,
    adminCode,
  } = options;

  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);
  const isConfiguredRef = useRef(false);
  const driverIdRef = useRef<string | undefined>(driverId);
  const adminCodeRef = useRef<string | undefined>(adminCode);
  const syncRetryIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if we're on native iOS
  const isNativeIOS = Capacitor.getPlatform() === 'ios' && (
    Capacitor.isNativePlatform() || (window as any).Capacitor?.isNativePlatform?.()
  );

  useEffect(() => {
    driverIdRef.current = driverId;
    adminCodeRef.current = adminCode;
  }, [driverId, adminCode]);

  // ─── IndexedDB offline sync (for fallback path & extra resilience) ───
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
        console.log(`[iOS-BG] Synced ${ids.length} offline locations`);
      }
    } catch (err) {
      console.warn('[iOS-BG] Offline queue drain failed, will retry:', err);
    }

    const count = await getPendingCount();
    setPendingOfflineCount(count);
  }, []);

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

  useEffect(() => {
    if (!enabled || !isNativeIOS) return;

    initializeBackgroundTracking();
    startSyncRetry();

    return () => {
      stopTracking();
      stopSyncRetry();
    };
  }, [enabled, isNativeIOS]);

  const initializeBackgroundTracking = async () => {
    try {
      const module = await import('@transistorsoft/capacitor-background-geolocation');
      BackgroundGeolocation = module.default;

      if (!BackgroundGeolocation) {
        console.error('BackgroundGeolocation plugin not available');
        return;
      }

      const currentDriverId = driverIdRef.current || localStorage.getItem('ftm_driver_id');
      const currentAdminCode = adminCodeRef.current || localStorage.getItem('ftm_admin_code');

      const state = await BackgroundGeolocation.ready({
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_NAVIGATION,
        distanceFilter: 3,
        stationaryRadius: 10,
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

        // Native HTTP service — persists in native SQLite, auto-syncs
        url: SUPABASE_FUNCTIONS_URL,
        method: 'POST',
        autoSync: true,
        autoSyncThreshold: 1,
        batchSync: false,
        maxBatchSize: 50,
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
        },
        params: {
          action: 'update-location',
          driverId: currentDriverId || '',
          adminCode: currentAdminCode || '',
          isBackground: true,
        },
      });

      console.log('[BackgroundGeolocation] Ready:', state);

      BackgroundGeolocation.onLocation(onLocation, onLocationError);
      BackgroundGeolocation.onMotionChange(onMotionChange);
      BackgroundGeolocation.onProviderChange(onProviderChange);
      BackgroundGeolocation.onHeartbeat(onHeartbeat);

      BackgroundGeolocation.onHttp((response: any) => {
        console.log('[BackgroundGeolocation] HTTP response:', response.status, response.responseText?.substring(0, 200));
        if (response.success) {
          setLastUpdate(new Date());
        }
      });

      isConfiguredRef.current = true;
      await startTracking();
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
