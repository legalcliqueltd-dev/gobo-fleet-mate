import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface LocationTrackingOptions {
  updateIntervalMs?: number;
  enableHighAccuracy?: boolean;
  maximumAge?: number;
}

export const useBackgroundLocationTracking = (
  enabled: boolean = true,
  options: LocationTrackingOptions = {}
) => {
  const {
    updateIntervalMs = 30000, // 30 seconds default
    enableHighAccuracy = true,
    maximumAge = 5000,
  } = options;

  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const lastSentRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) {
      stopTracking();
      return;
    }

    startTracking();

    return () => {
      stopTracking();
    };
  }, [enabled, updateIntervalMs]);

  const getOrCreateDevice = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Check for existing device
      const { data: devices, error: fetchError } = await supabase
        .from('devices')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (fetchError) throw fetchError;

      if (devices && devices.length > 0) {
        return devices[0].id;
      }

      // Create a new device for this user
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

  const handlePositionUpdate = (position: GeolocationPosition) => {
    const now = Date.now();
    
    // Throttle updates based on interval
    if (now - lastSentRef.current < updateIntervalMs) {
      return;
    }

    const { latitude, longitude, speed } = position.coords;
    const speedKmh = speed !== null ? speed * 3.6 : null; // Convert m/s to km/h

    sendLocationUpdate(latitude, longitude, speedKmh);
  };

  const handleError = (error: GeolocationPositionError) => {
    console.error('Location tracking error:', error);
    
    if (error.code === error.PERMISSION_DENIED) {
      toast.error('Location permission denied. Please enable location access.');
      setIsTracking(false);
    }
  };

  const startTracking = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your device');
      return;
    }

    if (watchIdRef.current !== null) {
      return; // Already tracking
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      handleError,
      {
        enableHighAccuracy,
        maximumAge,
        timeout: 10000,
      }
    );

    setIsTracking(true);
    console.log('Background location tracking started');
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setIsTracking(false);
      console.log('Background location tracking stopped');
    }
  };

  return {
    isTracking,
    lastUpdate,
    startTracking,
    stopTracking,
  };
};
