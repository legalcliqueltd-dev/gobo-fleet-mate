import { useState, useEffect, useRef, useCallback } from 'react';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBackgroundLocationTracking } from '@/hooks/useBackgroundLocationTracking';
import { useIOSBackgroundTracking } from '@/hooks/useIOSBackgroundTracking';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { Crosshair, Map, Package, Wifi, Signal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import DriverLocationMarker from '@/components/map/DriverLocationMarker';
import DriverStatusCard from '@/components/driver/DriverStatusCard';
import LocationBlocker from '@/components/driver/LocationBlocker';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';

type Task = {
  id: string;
  title: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
};

type TrailPoint = {
  lat: number;
  lng: number;
  timestamp: number;
  speed: number | null;
};

const TRAIL_STORAGE_KEY = 'driver_location_trail';
const MAX_TRAIL_AGE_MS = 24 * 60 * 60 * 1000;

export default function DriverAppDashboard() {
  const { session } = useDriverSession();
  const navigate = useNavigate();
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const [trail, setTrail] = useState<TrailPoint[]>([]);
  
  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

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

  // Browser-based tracking (skips on native iOS automatically)
  const { isTracking: browserIsTracking, batteryLevel: browserBattery, lastUpdate: browserLastUpdate } = useBackgroundLocationTracking(onDuty && locationPermissionGranted, {
    updateIntervalMs: 30000,
    batterySavingMode: localStorage.getItem('batterySavingMode') === 'true',
    enableHighAccuracy: localStorage.getItem('highAccuracyMode') !== 'false',
    driverId: session?.driverId,
    adminCode: session?.adminCode,
  });

  // Native iOS: use transistorsoft plugin for persistent background tracking
  const iosTracking = useIOSBackgroundTracking(onDuty && locationPermissionGranted, {
    updateIntervalMs: 30000,
    driverId: session?.driverId,
    adminCode: session?.adminCode,
  });

  // Unified tracking state
  const isTracking = isNativeIOS ? iosTracking.isTracking : browserIsTracking;
  const batteryLevel = isNativeIOS ? iosTracking.batteryLevel : browserBattery;
  const lastUpdate = isNativeIOS ? iosTracking.lastUpdate : browserLastUpdate;

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // On native iOS, use iOS tracking location for UI; on web, use watchPosition
  useEffect(() => {
    if (isNativeIOS && iosTracking.lastLocation) {
      const loc = iosTracking.lastLocation;
      setCurrentLocation({ lat: loc.latitude, lng: loc.longitude });
      setSpeed(loc.speed);
      setHeading(loc.heading);
      setAccuracy(loc.accuracy);
      setLastSyncTime(iosTracking.lastUpdate);

      // Add to trail
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

  // Watch position for real-time updates (web only)
  useEffect(() => {
    if (isNativeIOS) return; // iOS uses the plugin above
    if (!locationPermissionGranted || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const newLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentLocation(newLocation);
        setAccuracy(pos.coords.accuracy);
        if (pos.coords.speed !== null) setSpeed(pos.coords.speed * 3.6);
        if (pos.coords.heading !== null) setHeading(pos.coords.heading);
        setLastSyncTime(new Date());

        if (onDuty && pos.coords.accuracy < 100) {
          setTrail(prev => {
            const now = Date.now();
            const lastPoint = prev[prev.length - 1];
            if (lastPoint && now - lastPoint.timestamp < 10000) return prev;
            const newTrail = [
              ...prev.filter(p => now - p.timestamp < MAX_TRAIL_AGE_MS),
              { lat: newLocation.lat, lng: newLocation.lng, timestamp: now, speed: pos.coords.speed !== null ? pos.coords.speed * 3.6 : null }
            ];
            return newTrail.length > 500 ? newTrail.slice(-500) : newTrail;
          });
        }
      },
      (err) => console.error('Location watch error:', err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [locationPermissionGranted, onDuty, isNativeIOS]);

  // Load tasks via edge function (bypasses RLS)
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
    // Poll every 30 seconds
    const interval = setInterval(loadTasks, 30000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadTasks(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadTasks]);

  const centerOnLocation = useCallback(() => {
    if (mapRef.current && currentLocation) {
      mapRef.current.panTo(currentLocation);
      mapRef.current.setZoom(16);
    }
  }, [currentLocation]);

  const toggleMapType = useCallback(() => {
    setMapType(prev => prev === 'roadmap' ? 'satellite' : 'roadmap');
  }, []);

  const trailPath = trail.map(p => ({ lat: p.lat, lng: p.lng }));

  const getSignalQuality = () => {
    if (accuracy === null) return { label: 'Unknown', color: 'text-muted-foreground' };
    if (accuracy <= 10) return { label: 'Excellent', color: 'text-success' };
    if (accuracy <= 30) return { label: 'Good', color: 'text-success' };
    if (accuracy <= 100) return { label: 'Fair', color: 'text-warning' };
    return { label: 'Poor', color: 'text-destructive' };
  };

  const signalQuality = getSignalQuality();

  if (!locationPermissionGranted) {
    return (
      <LocationBlocker onPermissionGranted={() => setLocationPermissionGranted(true)} />
    );
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
      <div className="relative h-full w-full flex flex-col" style={{ minHeight: 'calc(100vh - 140px)' }}>
        <div className="flex-1 relative">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 200px)' }}
            center={currentLocation || { lat: 0, lng: 0 }}
            zoom={15}
            onLoad={(map) => { mapRef.current = map; }}
            mapTypeId={mapType}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
            }}
          >
            {trailPath.length > 1 && (
              <Polyline
                path={trailPath}
                options={{ strokeColor: '#3b82f6', strokeOpacity: 0.7, strokeWeight: 4, geodesic: true }}
              />
            )}

            {currentLocation && (
              <DriverLocationMarker position={currentLocation} isTracking={isTracking} heading={heading} />
            )}

            {tasks.map((task) => 
              task.dropoff_lat && task.dropoff_lng ? (
                <Marker
                  key={task.id}
                  position={{ lat: task.dropoff_lat, lng: task.dropoff_lng }}
                  icon={{
                    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%234ade80" stroke="%23ffffff" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
                    scaledSize: new google.maps.Size(32, 32),
                  }}
                  onClick={() => navigate('/app/tasks')}
                />
              ) : null
            )}
          </GoogleMap>

          <div className="absolute top-4 left-4 pointer-events-auto">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-sm",
              isTracking ? "bg-success/90 text-success-foreground" : "bg-muted/90 text-muted-foreground"
            )}>
              {isTracking ? <Wifi className="h-4 w-4 animate-pulse" /> : <Signal className="h-4 w-4" />}
              <span className="text-sm font-medium">
                {isTracking ? 'Tracking Active' : 'Tracking Off'}
              </span>
            </div>
          </div>

          <div className="absolute top-4 right-4 pointer-events-auto">
            <div className="bg-background/90 backdrop-blur-sm px-3 py-2 rounded-full shadow-lg">
              <div className="flex items-center gap-2">
                <Signal className={cn("h-4 w-4", signalQuality.color)} />
                <span className={cn("text-xs font-medium", signalQuality.color)}>
                  GPS: {signalQuality.label}
                </span>
                {accuracy !== null && (
                  <span className="text-xs text-muted-foreground">±{Math.round(accuracy)}m</span>
                )}
              </div>
            </div>
          </div>

          {tasks.length > 0 && (
            <div className="absolute top-16 left-4 pointer-events-auto">
              <Button variant="secondary" onClick={() => navigate('/app/tasks')} className="shadow-lg gap-2">
                <Package className="h-5 w-5" />
                {tasks.length} Task{tasks.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}

          <div className="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-auto">
            <Button size="icon" variant="secondary" onClick={centerOnLocation} className="shadow-lg h-10 w-10" title="Center on my location">
              <Crosshair className="h-5 w-5" />
            </Button>
            <Button size="icon" variant="secondary" onClick={toggleMapType} className="shadow-lg h-10 w-10" title="Toggle map type">
              <Map className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <DriverStatusCard
          speed={speed}
          batteryLevel={batteryLevel}
          lastSyncTime={lastSyncTime || lastUpdate}
          isTracking={isTracking}
          accuracy={accuracy}
        />
      </div>
    </DriverAppLayout>
  );
}
