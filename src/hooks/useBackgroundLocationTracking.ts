import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Geolocation } from '@capacitor/geolocation';

export interface LocationTrackingOptions {
  updateIntervalMs?: number;
  enableHighAccuracy?: boolean;
  maximumAge?: number;
  batterySavingMode?: boolean;
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
  } = options;

  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const watchIdRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const lastSentRef = useRef<number>(0);
  const batteryCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  const getOrCreateDevice = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // First check for device connected to this driver
      const { data: connectedDevice, error: connectedError } = await supabase
        .from('devices')
        .select('id')
        .eq('connected_driver_id', user.id)
        .maybeSingle();

      if (connectedError) throw connectedError;

      if (connectedDevice) {
        return connectedDevice.id;
      }

      // Fall back to checking for device owned by this user
      const { data: devices, error: fetchError } = await supabase
        .from('devices')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (fetchError) throw fetchError;

      if (devices && devices.length > 0) {
        return devices[0].id;
      }

      // Create a new device for this user (legacy support)
      const { data: newDevice, error: createError } = await supabase
        .from('devices')
        .insert({
          user_id: user.id,
          name: 'Mobile Device',
          status: 'active',
        })
        .select('id')
        .single();

      if (createError) throw createError;

      return newDevice.id;
    } catch (error) {
      console.error('Error getting/creating device:', error);
      return null;
    }
  };

  const sendLocationUpdate = async (
    latitude: number,
    longitude: number,
    speed: number | null
  ) => {
    if (!deviceIdRef.current) {
      deviceIdRef.current = await getOrCreateDevice();
      if (!deviceIdRef.current) return;
    }

    try {
      const { error } = await supabase.from('locations').insert({
        device_id: deviceIdRef.current,
        latitude,
        longitude,
        speed: speed || 0,
        timestamp: new Date().toISOString(),
      });

      if (error) throw error;

      setLastUpdate(new Date());
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

  const handlePositionUpdate = (latitude: number, longitude: number, speed: number | null) => {
    const now = Date.now();
    const effectiveInterval = getEffectiveInterval();
    
    // Throttle updates based on interval (with battery saving adjustments)
    if (now - lastSentRef.current < effectiveInterval) {
      return;
    }

    const speedKmh = speed !== null ? speed * 3.6 : null; // Convert m/s to km/h
    sendLocationUpdate(latitude, longitude, speedKmh);
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
      // Request permissions
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
          enableHighAccuracy,
          timeout: 10000,
          maximumAge,
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
              position.coords.speed
            );
          }
        }
      );

      watchIdRef.current = watchId;
      setIsTracking(true);
      console.log('Native background location tracking started');
      
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
        await Geolocation.clearWatch({ id: watchIdRef.current });
        watchIdRef.current = null;
        setIsTracking(false);
        console.log('Background location tracking stopped');
      } catch (error) {
        console.error('Error stopping location tracking:', error);
      }
    }
  };

  return {
    isTracking,
    lastUpdate,
    batteryLevel,
    startTracking,
    stopTracking,
  };
};
