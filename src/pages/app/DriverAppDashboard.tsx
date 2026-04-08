import { useState, useEffect, useRef, useCallback } from 'react';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBackgroundLocationTracking } from '@/hooks/useBackgroundLocationTracking';
import { useIOSBackgroundTracking } from '@/hooks/useIOSBackgroundTracking';
import { GoogleMap, useJsApiLoader, Polyline } from '@react-google-maps/api';
import AdvancedMarker from '@/components/map/AdvancedMarker';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { Crosshair, Map, Wifi, Signal, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import DriverLocationMarker from '@/components/map/DriverLocationMarker';
import DriverStatusCard from '@/components/driver/DriverStatusCard';
import LocationBlocker from '@/components/driver/LocationBlocker';
import ActiveTaskCard from '@/components/driver/ActiveTaskCard';
import TaskNavigationMap from '@/components/map/TaskNavigationMap';
import { cn } from '@/lib/utils';
import { detectNativePlatform, isIOS, isAndroid } from '@/utils/platformDetection';
import { isGeolocationPluginAvailable } from '@/utils/nativeGeolocation';
import { Geolocation } from '@capacitor/geolocation';

type Task = {
  id: string;
  title: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
  due_at?: string | null;
};

type TrailPoint = {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number | null;
};

const TRAIL_STORAGE_KEY = 'driver_location_trail';
const MAX_TRAIL_AGE_MS = 24 * 60 * 60 * 1000;
const IOS_TRANSISTOR_FAILED_KEY = 'ios_transistor_failed';

// Clean, minimal map style for better navigation UX
const CLEAN_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', stylers: [{ visibility: 'simplified' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e9f6' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f0e68c' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#f5f5f5' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#e8f5e9' }] },
];

export default function DriverAppDashboard() {
  const { session } = useDriverSession();
  const navigate = useNavigate();
  const mapRef = useRef<google.maps.Map | null>(null);
  const hasInitialCentered = useRef(false);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  const [navigatingTask, setNavigatingTask] = useState<Task | null>(null);
  const [followMode, setFollowMode] = useState(true);

  const isNativeIOS = detectNativePlatform() && isIOS();
  const isNativeAndroid = detectNativePlatform() && isAndroid();
  const useNativePlugin = (isNativeIOS || isNativeAndroid) && isGeolocationPluginAvailable();

  const [onDuty] = useState(() => {
    const stored = localStorage.getItem('driverOnDuty');
    return stored === null ? true : stored === 'true';
  });

  useEffect(() => {
    localStorage.setItem('driverOnDuty', String(onDuty));
  }, [onDuty]);

  // Load trail from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(TRAIL_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as TrailPoint[];
        const now = Date.now();
        const validTrail = parsed.filter(p => now - p.timestamp < MAX_TRAIL_AGE_MS);
        setTrail(validTrail);
      } catch (e) {
        console.error('Failed to parse stored trail:', e);
      }
    }
  }, []);

  // Save trail to localStorage when it changes
  useEffect(() => {
    if (trail.length > 0) {
      localStorage.setItem(TRAIL_STORAGE_KEY, JSON.stringify(trail));
    }
  }, [trail]);

  // Browser-based tracking (used for web/PWA and as Android non-iOS native tracker)
  const { isTracking: browserIsTracking, batteryLevel: browserBattery, lastUpdate: browserLastUpdate } = useBackgroundLocationTracking(onDuty && locationPermissionGranted, {
    updateIntervalMs: 30000,
    batterySavingMode: localStorage.getItem('batterySavingMode') === 'true',
    enableHighAccuracy: localStorage.getItem('highAccuracyMode') !== 'false',
    driverId: session?.driverId,
    adminCode: session?.adminCode,
  });

  // Detect if Transistorsoft failed to start on iOS — fall back to Capacitor Geolocation
  const [iosTransistorFailed, setIosTransistorFailed] = useState(() => {
    return isNativeIOS && localStorage.getItem(IOS_TRANSISTOR_FAILED_KEY) === 'true';
  });

  // Native iOS tracking (Transistorsoft)
  const iosTracking = useIOSBackgroundTracking(onDuty && locationPermissionGranted && !iosTransistorFailed, {
    updateIntervalMs: 30000,
    driverId: session?.driverId,
    adminCode: session?.adminCode,
  });

  // If iOS tracking was enabled but never started after 5 seconds, mark as failed
  useEffect(() => {
    if (!isNativeIOS || !locationPermissionGranted || !onDuty || iosTransistorFailed) return;
    const timeout = setTimeout(() => {
      if (!iosTracking.isTracking && !iosTracking.lastLocation) {
        console.warn('[Dashboard] Transistorsoft failed to start on iOS, falling back to Capacitor Geolocation');
        setIosTransistorFailed(true);
        localStorage.setItem(IOS_TRANSISTOR_FAILED_KEY, 'true');
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [isNativeIOS, locationPermissionGranted, onDuty, iosTracking.isTracking, iosTracking.lastLocation, iosTransistorFailed]);

  // Use iOS Transistorsoft if available, otherwise fall back to Capacitor tracking
  const useIOSFallback = isNativeIOS && iosTransistorFailed;
  const isTracking = (isNativeIOS && !iosTransistorFailed) ? iosTracking.isTracking : browserIsTracking;
  const batteryLevel = (isNativeIOS && !iosTransistorFailed) ? iosTracking.batteryLevel : browserBattery;
  const lastUpdate = (isNativeIOS && !iosTransistorFailed) ? iosTracking.lastUpdate : browserLastUpdate;

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Auto-rotate and follow driver on map
  useEffect(() => {
    if (!mapRef.current || !currentLocation || !followMode) return;

    mapRef.current.panTo(currentLocation);

    // Tilt & heading for navigation feel when moving
    if (heading !== null && heading !== undefined && !isNaN(heading) && speed !== null && speed > 5) {
      try {
        mapRef.current.setTilt(45);
        mapRef.current.setHeading(heading);
      } catch {
        // setTilt/setHeading requires mapId (WebGL) – silently ignore if not available
      }
    }
  }, [currentLocation, heading, speed, followMode]);

  // iOS location updates
  useEffect(() => {
    if (isNativeIOS && iosTracking.lastLocation) {
      const loc = iosTracking.lastLocation;
      setCurrentLocation({ lat: loc.latitude, lng: loc.longitude });
      setSpeed(loc.speed);
      setHeading(loc.heading);
      setAccuracy(loc.accuracy);
      setLastSyncTime(iosTracking.lastUpdate);

      if (onDuty && loc.accuracy !== null && loc.accuracy < 100) {
        setTrail(prev => {
          const now = Date.now();
          const lastPoint = prev[prev.length - 1];
          if (lastPoint && now - lastPoint.timestamp < 10000) return prev;
          const newTrail = [
            ...prev.filter(p => now - p.timestamp < MAX_TRAIL_AGE_MS),
            { lat: loc.latitude, lng: loc.longitude, timestamp: now, speed: loc.speed }
          ];
          return newTrail.length > 500 ? newTrail.slice(-500) : newTrail;
        });
      }
    }
  }, [isNativeIOS, iosTracking.lastLocation, iosTracking.lastUpdate, onDuty]);

  // Position watch — uses Capacitor on native (Android + iOS fallback), browser on web/PWA
  useEffect(() => {
    if (isNativeIOS && !useIOSFallback) return; // iOS handled by Transistorsoft above (unless it failed)
    if (!locationPermissionGranted) return;

    let watchId: string | number | null = null;

    const addTrailPoint = (lat: number, lng: number, spd: number | null) => {
      if (!onDuty) return;
      setTrail(prev => {
        const now = Date.now();
        const lastPoint = prev[prev.length - 1];
        if (lastPoint && now - lastPoint.timestamp < 10000) return prev;
        const newTrail = [
          ...prev.filter(p => now - p.timestamp < MAX_TRAIL_AGE_MS),
          { lat, lng, timestamp: now, speed: spd }
        ];
        return newTrail.length > 500 ? newTrail.slice(-500) : newTrail;
      });
    };

    const updateState = (lat: number, lng: number, acc: number, spd: number | null, hdg: number | null) => {
      const newLocation = { lat, lng };
      setCurrentLocation(newLocation);
      setAccuracy(acc);
      if (spd !== null) setSpeed(spd * 3.6);
      if (hdg !== null) setHeading(hdg);
      setLastSyncTime(new Date());

      if (!hasInitialCentered.current && mapRef.current) {
        mapRef.current.panTo(newLocation);
        mapRef.current.setZoom(16);
        hasInitialCentered.current = true;
      }

      if (acc < 100) addTrailPoint(lat, lng, spd !== null ? spd * 3.6 : null);
    };

    if (isNativeAndroid && isGeolocationPluginAvailable()) {
      // Native Android — use Capacitor Geolocation exclusively
      console.log('[Dashboard] Using native Capacitor Geolocation for Android');
      Geolocation.watchPosition(
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
        (pos, err) => {
          if (err) {
            console.error('[Dashboard] Native watch error:', err);
            return;
          }
          if (pos) {
            updateState(
              pos.coords.latitude,
              pos.coords.longitude,
              pos.coords.accuracy || 0,
              pos.coords.speed,
              pos.coords.heading
            );
          }
        }
      ).then(id => { watchId = id; });
    } else if (!detectNativePlatform() && navigator.geolocation) {
      // Web/PWA — use browser geolocation
      console.log('[Dashboard] Using browser geolocation');
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          updateState(
            pos.coords.latitude,
            pos.coords.longitude,
            pos.coords.accuracy,
            pos.coords.speed,
            pos.coords.heading
          );
        },
        (err) => console.error('Location watch error:', err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    }

    return () => {
      if (watchId !== null) {
        if (isNativeAndroid && isGeolocationPluginAvailable()) {
          Geolocation.clearWatch({ id: watchId as string }).catch(console.error);
        } else {
          navigator.geolocation.clearWatch(watchId as number);
        }
      }
    };
  }, [locationPermissionGranted, onDuty, isNativeIOS, isNativeAndroid]);

  // Load tasks
  const loadTasks = useCallback(async () => {
    if (!session?.driverId || !session?.adminCode) return;
    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'get-tasks',
          driverId: session.driverId,
          adminCode: session.adminCode,
          statuses: ['assigned', 'en_route'],
        },
      });
      if (error) throw error;
      if (data?.tasks) setTasks(data.tasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  }, [session?.driverId, session?.adminCode]);

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 30000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadTasks(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadTasks]);

  // Heartbeat
  useEffect(() => {
    if (!session?.driverId) return;
    const sendHeartbeat = async () => {
      try {
        await supabase.functions.invoke('connect-driver', {
          body: { action: 'update-status', driverId: session.driverId, status: 'active', batteryLevel: batteryLevel ?? undefined },
        });
      } catch (e) {
        console.warn('Heartbeat failed:', e);
      }
    };
    const heartbeatInterval = setInterval(sendHeartbeat, 60000);
    return () => clearInterval(heartbeatInterval);
  }, [session?.driverId, batteryLevel]);

  // Trail sync
  useEffect(() => {
    if (!session?.driverId || !session?.adminCode) return;
    const syncTrail = async () => {
      const stored = localStorage.getItem(TRAIL_STORAGE_KEY);
      if (!stored) return;
      try {
        const trailPoints: TrailPoint[] = JSON.parse(stored);
        const lastSyncTs = parseInt(localStorage.getItem('trail_last_sync_ts') || '0', 10);
        const unsyncedPoints = trailPoints.filter(p => p.timestamp > lastSyncTs);
        if (unsyncedPoints.length === 0) return;
        const { data, error } = await supabase.functions.invoke('connect-driver', {
          body: { action: 'sync-trail', driverId: session.driverId, adminCode: session.adminCode, trailPoints: unsyncedPoints },
        });
        if (!error && data?.success) {
          localStorage.setItem('trail_last_sync_ts', String(Date.now()));
        }
      } catch (e) {
        console.warn('Trail sync failed:', e);
      }
    };
    syncTrail();
    const handleVisibilityTrail = () => { if (document.visibilityState === 'visible') syncTrail(); };
    const handleOnline = () => syncTrail();
    document.addEventListener('visibilitychange', handleVisibilityTrail);
    window.addEventListener('online', handleOnline);
    const syncInterval = setInterval(syncTrail, 5 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityTrail);
      window.removeEventListener('online', handleOnline);
      clearInterval(syncInterval);
    };
  }, [session?.driverId, session?.adminCode]);

  const centerOnLocation = useCallback(() => {
    if (mapRef.current && currentLocation) {
      mapRef.current.panTo(currentLocation);
      mapRef.current.setZoom(16);
      setFollowMode(true);
    }
  }, [currentLocation]);

  const toggleMapType = useCallback(() => {
    setMapType(prev => prev === 'roadmap' ? 'satellite' : 'roadmap');
  }, []);

  const trailPath = trail.map(p => ({ lat: p.lat, lng: p.lng }));

  // Auto-zoom to show driver + active task dropoff
  const activeTask = tasks.find(t => t.status === 'en_route') || tasks[0] || null;

  const getSignalQuality = () => {
    if (accuracy === null) return { label: 'Unknown', color: 'text-muted-foreground', icon: '○' };
    if (accuracy <= 10) return { label: 'Excellent', color: 'text-success', icon: '●' };
    if (accuracy <= 30) return { label: 'Good', color: 'text-success', icon: '●' };
    if (accuracy <= 100) return { label: 'Fair', color: 'text-warning', icon: '◐' };
    return { label: 'Poor', color: 'text-destructive', icon: '○' };
  };

  const signalQuality = getSignalQuality();

  if (!locationPermissionGranted) {
    return <LocationBlocker onPermissionGranted={() => setLocationPermissionGranted(true)} />;
  }

  if (!isLoaded) {
    return (
      <DriverAppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </DriverAppLayout>
    );
  }

  return (
    <DriverAppLayout>
      {/* Full-screen navigation overlay */}
      {navigatingTask && navigatingTask.dropoff_lat && navigatingTask.dropoff_lng && (
        <TaskNavigationMap
          dropoffLat={navigatingTask.dropoff_lat}
          dropoffLng={navigatingTask.dropoff_lng}
          taskTitle={navigatingTask.title}
          onClose={() => setNavigatingTask(null)}
        />
      )}

      <div className="relative h-full w-full flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        <div className="flex-1 relative">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 200px)' }}
            center={currentLocation || { lat: 0, lng: 0 }}
            zoom={16}
            onLoad={(map) => {
              mapRef.current = map;
              if (currentLocation) {
                map.panTo(currentLocation);
                hasInitialCentered.current = true;
              }
            }}
            onDragStart={() => setFollowMode(false)}
            mapTypeId={mapType}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
              styles: mapType === 'roadmap' ? CLEAN_MAP_STYLE : undefined,
            }}
          >
            {/* Trail polyline */}
            {trailPath.length > 1 && (
              <Polyline
                path={trailPath}
                options={{ strokeColor: '#3b82f6', strokeOpacity: 0.8, strokeWeight: 5, geodesic: true }}
              />
            )}

            {/* Driver marker */}
            {currentLocation && (
              <DriverLocationMarker position={currentLocation} isTracking={isTracking} heading={heading} />
            )}

            {/* Task dropoff markers */}
            {tasks.map((task) =>
              task.dropoff_lat && task.dropoff_lng ? (
                <AdvancedMarker
                  key={task.id}
                  position={{ lat: task.dropoff_lat, lng: task.dropoff_lng }}
                  iconSize={36}
                  onClick={() => setNavigatingTask(task)}
                >
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-destructive border-[3px] border-white shadow-xl flex items-center justify-center">
                      <span className="text-destructive-foreground text-xs font-bold">📍</span>
                    </div>
                  </div>
                </AdvancedMarker>
              ) : null
            )}
          </GoogleMap>

          {/* Top-left: tracking status */}
          <div className="absolute top-4 left-4 pointer-events-auto">
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-md',
              isTracking ? 'bg-success/90 text-success-foreground' : 'bg-muted/90 text-muted-foreground'
            )}>
              {isTracking ? <Wifi className="h-4 w-4 animate-pulse" /> : <Signal className="h-4 w-4" />}
              <span className="text-sm font-semibold">
                {isTracking ? 'Live' : 'Off'}
              </span>
              {speed !== null && speed > 0 && (
                <span className="text-sm font-medium ml-1">{Math.round(speed)} km/h</span>
              )}
            </div>
          </div>

          {/* Top-right: GPS quality */}
          <div className="absolute top-4 right-4 pointer-events-auto">
            <div className="bg-background/90 backdrop-blur-md px-3 py-2 rounded-full shadow-lg">
              <div className="flex items-center gap-1.5">
                <Signal className={cn('h-3.5 w-3.5', signalQuality.color)} />
                <span className={cn('text-xs font-semibold', signalQuality.color)}>
                  {signalQuality.label}
                </span>
                {accuracy !== null && (
                  <span className="text-xs text-muted-foreground">±{Math.round(accuracy)}m</span>
                )}
              </div>
            </div>
          </div>

          {/* Map controls - right side */}
          <div className="absolute bottom-28 right-4 flex flex-col gap-2 pointer-events-auto">
            <Button
              size="icon"
              variant="secondary"
              onClick={centerOnLocation}
              className={cn(
                'shadow-lg h-11 w-11 rounded-full',
                followMode && 'ring-2 ring-primary'
              )}
            >
              <Crosshair className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={toggleMapType}
              className="shadow-lg h-11 w-11 rounded-full"
            >
              <Layers className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Bottom card area */}
        <div className="absolute bottom-0 left-0 right-0 p-3 pointer-events-auto">
          {activeTask ? (
            <ActiveTaskCard
              task={activeTask}
              driverLocation={currentLocation}
              onNavigate={() => setNavigatingTask(activeTask)}
            />
          ) : (
            <DriverStatusCard
              isTracking={isTracking}
              batteryLevel={batteryLevel}
              lastSyncTime={lastUpdate}
              speed={speed}
              accuracy={accuracy}
            />
          )}
        </div>
      </div>
    </DriverAppLayout>
  );
}
