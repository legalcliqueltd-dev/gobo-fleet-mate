import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

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
    updateIntervalMs = 30000, // 30 seconds default
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
  // Union type to handle both Capacitor (string) and browser (number) watch IDs
  const watchIdRef = useRef<string | number | null>(null);
  const lastSentRef = useRef<number>(0);
  const batteryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const driverIdRef = useRef<string | undefined>(driverId);
  const adminCodeRef = useRef<string | undefined>(adminCode);
  const lowAccuracyCountRef = useRef<number>(0);
  const isFetchingAccurateRef = useRef<boolean>(false);

  // Update refs when props change
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
    const currentDriverId = driverIdRef.current;
    
    if (!currentDriverId) {
      console.log('No driver ID available for location update');
      return;
    }

    try {
      // Use connect-driver edge function for location updates (correct approach)
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'update-location',
          driverId: currentDriverId,
          latitude,
          longitude,
          speed: speed || 0,
          accuracy: accuracyM,
          batteryLevel,
        },
      });

      if (error) throw error;
      
      // Check if driver needs to re-login
      if (data?.requiresRelogin) {
        toast.error('Session expired. Please reconnect.');
        return;
      }

      setLastUpdate(new Date());
      setAccuracy(accuracyM);
      lastSentRef.current = Date.now();
    } catch (error) {
      console.error('Error sending location update:', error);
    }
  };

  const getEffectiveInterval = () => {
    if (batterySavingMode && batteryLevel < 20) {
      return Math.max(updateIntervalMs * 3, 60000); // 3x interval or minimum 1 minute
    } else if (batterySavingMode && batteryLevel < 50) {
      return Math.max(updateIntervalMs * 2, 30000); // 2x interval or minimum 30 seconds
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
    
    // Throttle updates based on interval (with battery saving adjustments)
    if (now - lastSentRef.current < effectiveInterval) {
      return;
    }

    // Log accuracy but let the server decide whether to store
    // Server enforces 30m threshold; client sends all positions so heartbeat stays alive
    if (accuracyM > ACCURACY_THRESHOLD_M) {
      console.log(`Low accuracy position: ${accuracyM}m (server will filter if > ${ACCURACY_THRESHOLD_M}m)`);
    }

    const speedKmh = speed !== null ? speed * 3.6 : null; // Convert m/s to km/h
    sendLocationUpdate(latitude, longitude, speedKmh, accuracyM);
  };

  const startBatteryMonitoring = async () => {
    // Check battery level periodically
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
    batteryCheckIntervalRef.current = setInterval(checkBattery, 60000); // Check every minute
  };

  const stopBatteryMonitoring = () => {
    if (batteryCheckIntervalRef.current) {
      clearInterval(batteryCheckIntervalRef.current);
      batteryCheckIntervalRef.current = null;
    }
  };

  const startTracking = async () => {
    if (watchIdRef.current !== null) {
      return; // Already tracking
    }

    try {
      if (Capacitor.isNativePlatform()) {
        // Native platform - use Capacitor Geolocation
        const permission = await Geolocation.checkPermissions();
        
        if (permission.location !== 'granted') {
          const requestResult = await Geolocation.requestPermissions();
          if (requestResult.location !== 'granted') {
            toast.error('Location permission denied. Please enable location access in settings.');
            return;
          }
        }

        // Start watching position using Capacitor Geolocation
        const watchId = await Geolocation.watchPosition(
        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0, // Force fresh position, no caching
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
        console.log('Native background location tracking started');
      } else {
        // Web browser - use navigator.geolocation
        if (!navigator.geolocation) {
          toast.error('Geolocation is not supported by this browser.');
          return;
        }

        // Check/request permission via getCurrentPosition (triggers browser prompt)
        const watchId = navigator.geolocation.watchPosition(
          (position) => {
            // Process with accuracy value for filtering
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
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0, // Force fresh position, no caching
          }
        );

        watchIdRef.current = watchId;
        setIsTracking(true);
        console.log('Browser location tracking started');
      }
      
      // Notify user about battery saving mode
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
        if (Capacitor.isNativePlatform()) {
          // Native - use Capacitor to clear watch
          await Geolocation.clearWatch({ id: watchIdRef.current as string });
        } else {
          // Browser - use navigator.geolocation
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
