import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

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
  const isConfiguredRef = useRef(false);
  const driverIdRef = useRef<string | undefined>(driverId);
  const adminCodeRef = useRef<string | undefined>(adminCode);

  // Check if we're on native iOS
  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  // Keep refs updated
  useEffect(() => {
    driverIdRef.current = driverId;
    adminCodeRef.current = adminCode;
  }, [driverId, adminCode]);

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
      const module = await import('@transistorsoft/capacitor-background-geolocation');
      BackgroundGeolocation = module.default;

      if (!BackgroundGeolocation) {
        console.error('BackgroundGeolocation plugin not available');
        return;
      }

      const currentDriverId = driverIdRef.current || localStorage.getItem('ftm_driver_id');
      const currentAdminCode = adminCodeRef.current || localStorage.getItem('ftm_admin_code');

      // Configure with native HTTP service for offline persistence
      const state = await BackgroundGeolocation.ready({
        // Location Config
        desiredAccuracy: BackgroundGeolocation.DESIRED_ACCURACY_NAVIGATION,
        distanceFilter: 3,
        stationaryRadius: 10,
        stopOnTerminate: false,
        startOnBoot: true,
        
        // Activity Recognition
        stopTimeout: 3,
        activityRecognitionInterval: 5000,
        
        // Application config
        debug: false,
        logLevel: BackgroundGeolocation.LOG_LEVEL_WARNING,
        
        // iOS specific
        preventSuspend: true,
        pausesLocationUpdatesAutomatically: false,
        locationAuthorizationRequest: 'Always',
        showsBackgroundLocationIndicator: true,
        
        // Location update intervals
        locationUpdateInterval: 10000,
        fastestLocationUpdateInterval: 5000,
        
        // Heartbeat
        heartbeatInterval: Math.floor(updateIntervalMs / 1000),
        
        // Background fetch
        enableHeadless: true,

        // === NATIVE HTTP SERVICE (persists offline, syncs automatically) ===
        url: SUPABASE_FUNCTIONS_URL,
        method: 'POST',
        autoSync: true,
        autoSyncThreshold: 1, // Upload as soon as 1 location is available
        batchSync: false, // Send individual locations for simplicity
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

      // Listen for location updates (UI state only — native HTTP handles server sync)
      BackgroundGeolocation.onLocation(onLocation, onLocationError);
      
      // Listen for motion changes
      BackgroundGeolocation.onMotionChange(onMotionChange);
      
      // Listen for provider changes (GPS enabled/disabled)
      BackgroundGeolocation.onProviderChange(onProviderChange);
      
      // Listen for heartbeat events
      BackgroundGeolocation.onHeartbeat(onHeartbeat);

      // Listen for HTTP responses to monitor sync health
      BackgroundGeolocation.onHttp((response: any) => {
        console.log('[BackgroundGeolocation] HTTP response:', response.status, response.responseText?.substring(0, 200));
        if (response.success) {
          setLastUpdate(new Date());
        }
      });

      isConfiguredRef.current = true;

      // Start tracking
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

    // Update battery from plugin data
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
          persist: true, // This will trigger native HTTP upload
        });
        // Update UI state
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
    startTracking,
    stopTracking,
    isNativeIOS,
  };
};
