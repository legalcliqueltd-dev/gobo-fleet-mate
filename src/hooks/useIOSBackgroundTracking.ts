import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Dynamic import for background geolocation (only available on native)
let BackgroundGeolocation: any = null;

interface BackgroundTrackingOptions {
  updateIntervalMs?: number;
  distanceFilter?: number;
  enableHighAccuracy?: boolean;
}

interface LocationData {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  heading: number | null;
  timestamp: Date;
}

export const useIOSBackgroundTracking = (
  enabled: boolean = true,
  options: BackgroundTrackingOptions = {}
) => {
  const {
    updateIntervalMs = 30000,
    distanceFilter = 10, // meters
    enableHighAccuracy = true,
  } = options;

  const [isTracking, setIsTracking] = useState(false);
  const [lastLocation, setLastLocation] = useState<LocationData | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const deviceIdRef = useRef<string | null>(null);
  const lastSentRef = useRef<number>(0);
  const isConfiguredRef = useRef(false);

  // Check if we're on native iOS
  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  useEffect(() => {
    if (!enabled || !isNativeIOS) {
      return;
    }

    initializeBackgroundTracking();

    return () => {
      stopTracking();
    };
  }, [enabled, isNativeIOS]);

  const initializeBackgroundTracking = async () => {
    try {
      // Dynamically import the background geolocation plugin
      const module = await import('@transistorsoft/capacitor-background-geolocation');
      BackgroundGeolocation = module.default;

      if (!BackgroundGeolocation) {
        console.error('BackgroundGeolocation plugin not available');
        return;
      }

      // Configure the plugin
      const state = await BackgroundGeolocation.ready({
        // Location Config
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_HIGH,
        distanceFilter: distanceFilter,
        stopOnTerminate: false, // Continue tracking when app is terminated
        startOnBoot: true, // Auto-start on device boot
        
        // Activity Recognition
        stopTimeout: 5, // Minutes to wait before aggressive location tracking stops
        
        // Application config
        debug: false, // Disable debug sounds/notifications in production
        logLevel: BackgroundGeolocation.LOG_LEVEL_WARNING,
        
        // iOS specific
        preventSuspend: true, // Prevent iOS from suspending the app
        pausesLocationUpdatesAutomatically: false,
        
        // Heartbeat interval (for periodic updates even when stationary)
        heartbeatInterval: Math.floor(updateIntervalMs / 1000),
        
        // Background fetch
        enableHeadless: true,
      });

      console.log('[BackgroundGeolocation] Ready:', state);

      // Listen for location updates
      BackgroundGeolocation.onLocation(onLocation, onLocationError);
      
      // Listen for motion changes
      BackgroundGeolocation.onMotionChange(onMotionChange);
      
      // Listen for provider changes (GPS enabled/disabled)
      BackgroundGeolocation.onProviderChange(onProviderChange);
      
      // Listen for heartbeat events
      BackgroundGeolocation.onHeartbeat(onHeartbeat);

      isConfiguredRef.current = true;

      // Start tracking
      await startTracking();
    } catch (error) {
      console.error('[BackgroundGeolocation] Init error:', error);
      toast.error('Failed to initialize background location tracking');
    }
  };

  const onLocation = async (location: any) => {
    console.log('[BackgroundGeolocation] Location:', location.coords);
    
    const locationData: LocationData = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      speed: location.coords.speed !== undefined ? location.coords.speed * 3.6 : null, // Convert m/s to km/h
      accuracy: location.coords.accuracy,
      heading: location.coords.heading,
      timestamp: new Date(location.timestamp),
    };

    setLastLocation(locationData);
    setLastUpdate(new Date());

    // Check if accuracy is acceptable (< 100m)
    if (location.coords.accuracy > 100) {
      console.log('[BackgroundGeolocation] Skipping low accuracy location:', location.coords.accuracy);
      return;
    }

    // Throttle database updates
    const now = Date.now();
    if (now - lastSentRef.current < updateIntervalMs) {
      return;
    }

    await sendLocationUpdate(
      location.coords.latitude,
      location.coords.longitude,
      location.coords.speed !== undefined ? location.coords.speed * 3.6 : null
    );
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
    
    // On heartbeat, get current location and send update
    if (BackgroundGeolocation) {
      try {
        const location = await BackgroundGeolocation.getCurrentPosition({
          maximumAge: 0,
          timeout: 30000,
          desiredAccuracy: 10,
        });
        await onLocation(location);
      } catch (error) {
        console.error('[BackgroundGeolocation] Heartbeat getCurrentPosition error:', error);
      }
    }
  };

  const getOrCreateDevice = async (): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return null;
      }

      const { data: connectedDevice } = await supabase
        .from('devices')
        .select('id')
        .eq('connected_driver_id', user.id)
        .maybeSingle();

      if (connectedDevice) {
        return connectedDevice.id;
      }

      return null;
    } catch (error) {
      console.error('Error getting device:', error);
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

      lastSentRef.current = Date.now();
      console.log('[BackgroundGeolocation] Location synced to database');
    } catch (error) {
      console.error('Error sending location update:', error);
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
    startTracking,
    stopTracking,
    isNativeIOS,
  };
};
