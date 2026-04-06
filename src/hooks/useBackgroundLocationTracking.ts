import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { queueOfflineAction } from '@/components/OfflineQueue';
import { Geolocation } from '@capacitor/geolocation';
import { detectNativePlatform, isIOS, isAndroid } from '@/utils/platformDetection';
import { isGeolocationPluginAvailable } from '@/utils/nativeGeolocation';

// Accuracy threshold in meters - only accept high-precision locations
const ACCURACY_THRESHOLD_M = 30;
// How many consecutive low-accuracy readings before forcing a fresh GPS fix
const MAX_LOW_ACCURACY_COUNT = 2;

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
  const watchIdRef = useRef<string | number | null>(null);
  const lastSentRef = useRef<number>(0);
  const batteryCheckIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const driverIdRef = useRef<string | undefined>(driverId);
  const adminCodeRef = useRef<string | undefined>(adminCode);
  const lowAccuracyCountRef = useRef<number>(0);
  const isFetchingAccurateRef = useRef<boolean>(false);

  const isNative = detectNativePlatform();
  const isNativeIOS = isNative && isIOS();
  const isNativeAndroid = isNative && isAndroid();
  const useNativePlugin = isNative && isGeolocationPluginAvailable();

  useEffect(() => {
    driverIdRef.current = driverId;
    adminCodeRef.current = adminCode;
  }, [driverId, adminCode]);

  useEffect(() => {
    if (!enabled) {
      stopTracking();
      return;
    }

    startTracking();
    startBatteryMonitoring();

    return () => {
      stopTracking();
      stopBatteryMonitoring();
    };
  }, [enabled, updateIntervalMs, enableHighAccuracy, batterySavingMode]);

  const sendLocationUpdate = async (
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
      batteryLevel,
    };

    if (!navigator.onLine) {
      queueOfflineAction('location', locationPayload);
      setLastUpdate(new Date());
      lastSentRef.current = Date.now();
      return;
    }

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
      console.error('Error sending location update, queueing offline:', error);
      queueOfflineAction('location', locationPayload);
      setLastUpdate(new Date());
      lastSentRef.current = Date.now();
    }
  };

  const getEffectiveInterval = () => {
    if (batterySavingMode && batteryLevel < 20) {
      return Math.max(updateIntervalMs * 3, 60000);
    } else if (batterySavingMode && batteryLevel < 50) {
      return Math.max(updateIntervalMs * 2, 30000);
    }
    return updateIntervalMs;
  };

  const handlePositionUpdate = (
    latitude: number,
    longitude: number,
    speed: number | null,
    accuracyM: number
  ) => {
    const now = Date.now();
    const effectiveInterval = getEffectiveInterval();

    if (now - lastSentRef.current < effectiveInterval) return;

    if (accuracyM > ACCURACY_THRESHOLD_M) {
      lowAccuracyCountRef.current++;
      console.log(`Low accuracy position: ${accuracyM}m (attempt ${lowAccuracyCountRef.current}/${MAX_LOW_ACCURACY_COUNT})`);
      if (lowAccuracyCountRef.current >= MAX_LOW_ACCURACY_COUNT && !isFetchingAccurateRef.current) {
        requestAccuratePosition();
      }
      const speedKmh = speed !== null ? speed * 3.6 : null;
      sendLocationUpdate(latitude, longitude, speedKmh, accuracyM);
      return;
    }

    lowAccuracyCountRef.current = 0;
    const speedKmh = speed !== null ? speed * 3.6 : null;
    sendLocationUpdate(latitude, longitude, speedKmh, accuracyM);
  };

  /**
   * Force a high-accuracy GPS fix.
   * On native Android, uses only Capacitor — never browser fallback.
   */
  const requestAccuratePosition = async () => {
    if (isFetchingAccurateRef.current) return;
    isFetchingAccurateRef.current = true;
    console.log('[LocationTracking] Requesting fresh high-accuracy GPS fix...');

    try {
      if (useNativePlugin) {
        // Native (Android or iOS) — use Capacitor exclusively
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 0,
        });
        if (position) {
          const acc = position.coords.accuracy || 0;
          console.log(`[LocationTracking] Fresh GPS fix accuracy: ${acc}m`);
          if (acc <= ACCURACY_THRESHOLD_M) {
            lowAccuracyCountRef.current = 0;
            const speedKmh = position.coords.speed !== null ? position.coords.speed * 3.6 : null;
            sendLocationUpdate(position.coords.latitude, position.coords.longitude, speedKmh, acc);
          }
        }
      } else if (!isNativeAndroid && navigator.geolocation) {
        // Web/PWA only — browser geolocation is acceptable
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const acc = position.coords.accuracy;
            console.log(`[LocationTracking] Fresh GPS fix accuracy: ${acc}m`);
            if (acc <= ACCURACY_THRESHOLD_M) {
              lowAccuracyCountRef.current = 0;
              const speedKmh = position.coords.speed !== null ? position.coords.speed * 3.6 : null;
              sendLocationUpdate(position.coords.latitude, position.coords.longitude, speedKmh, acc);
            }
          },
          (error) => console.error('[LocationTracking] Fresh GPS fix failed:', error),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
      }
    } catch (error) {
      console.error('[LocationTracking] requestAccuratePosition error:', error);
    } finally {
      isFetchingAccurateRef.current = false;
    }
  };

  const startBatteryMonitoring = async () => {
    const checkBattery = async () => {
      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          setBatteryLevel(Math.round(battery.level * 100));
        }
      } catch (error) {
        console.log('Battery monitoring not available');
      }
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

  const startTracking = async () => {
    if (watchIdRef.current !== null) return;

    // On native iOS, skip — useIOSBackgroundTracking handles it
    if (isNativeIOS) {
      console.log('[LocationTracking] Native iOS detected — deferring to useIOSBackgroundTracking');
      setIsTracking(true);
      return;
    }

    // Get an initial high-accuracy fix
    await requestAccuratePosition();

    try {
      if (useNativePlugin) {
        // Native Android — use Capacitor Geolocation exclusively
        const permission = await Geolocation.checkPermissions();

        if (permission.location !== 'granted') {
          const requestResult = await Geolocation.requestPermissions();
          if (requestResult.location !== 'granted') {
            toast.error('Location permission denied. Please enable location access in settings.');
            return;
          }
        }

        const watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          },
          (position, err) => {
            if (err) {
              console.error('Location tracking error:', err);
              if (err.message.includes('permission')) {
                toast.error('Location permission denied. Please enable location access.');
                setIsTracking(false);
              }
              return;
            }
            if (position) {
              handlePositionUpdate(
                position.coords.latitude,
                position.coords.longitude,
                position.coords.speed,
                position.coords.accuracy || 0
              );
            }
          }
        );

        watchIdRef.current = watchId;
        setIsTracking(true);
        console.log('Native Capacitor location tracking started');
      } else if (!isNativeAndroid) {
        // Web/PWA — browser geolocation
        if (!navigator.geolocation) {
          toast.error('Geolocation is not supported by this browser.');
          return;
        }

        console.log('[LocationTracking] Using browser geolocation (web/PWA)');
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            handlePositionUpdate(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.speed,
              position.coords.accuracy
            );
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
        setIsTracking(true);
        console.log('Browser location tracking started');
      } else {
        // Native Android but plugin unavailable — error state
        console.error('[LocationTracking] Native Android but Geolocation plugin unavailable. Manifest permissions may be missing.');
        toast.error('Location plugin unavailable. Please reinstall the app.');
      }

      if (batterySavingMode) {
        toast.success('Battery saving mode enabled - tracking frequency adjusts based on battery level');
      }
    } catch (error) {
      console.error('Failed to start location tracking:', error);
      toast.error('Failed to start location tracking. Please check permissions.');
    }
  };

  const stopTracking = async () => {
    if (watchIdRef.current !== null) {
      try {
        if (useNativePlugin) {
          await Geolocation.clearWatch({ id: watchIdRef.current as string });
        } else {
          navigator.geolocation.clearWatch(watchIdRef.current as number);
        }
        watchIdRef.current = null;
        setIsTracking(false);
        console.log('Location tracking stopped');
      } catch (error) {
        console.error('Error stopping location tracking:', error);
      }
    }
  };

  return {
    isTracking,
    lastUpdate,
    batteryLevel,
    accuracy,
    startTracking,
    stopTracking,
  };
};
