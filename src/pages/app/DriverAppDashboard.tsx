import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBackgroundLocationTracking } from '@/hooks/useBackgroundLocationTracking';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { Crosshair, Map, Power, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import DriverLocationMarker from '@/components/map/DriverLocationMarker';
import DriverStatusCard from '@/components/driver/DriverStatusCard';
import { cn } from '@/lib/utils';

type Task = {
  id: string;
  title: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
};

export default function DriverAppDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [onDuty, setOnDuty] = useState(false);
  const [speed, setSpeed] = useState<number | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  
  const { isTracking, batteryLevel, lastUpdate } = useBackgroundLocationTracking(onDuty, {
    updateIntervalMs: 30000,
    batterySavingMode: true,
  });

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  // Watch position for real-time speed and heading updates
  useEffect(() => {
    if (!onDuty || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        
        // Speed in m/s, convert to km/h
        if (pos.coords.speed !== null) {
          setSpeed(pos.coords.speed * 3.6);
        }
        
        // Heading in degrees
        if (pos.coords.heading !== null) {
          setHeading(pos.coords.heading);
        }
        
        setLastSyncTime(new Date());
      },
      (err) => {
        console.error('Location watch error:', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [onDuty]);

  // Get initial location when off duty
  useEffect(() => {
    if (onDuty) return;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        (err) => {
          console.error('Location error:', err);
          toast.error('Could not get your location');
        }
      );
    }
  }, [onDuty]);

  // Load tasks
  useEffect(() => {
    loadTasks();
    
    const tasksChannel = supabase
      .channel('driver-app-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadTasks)
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
    };
  }, []);

  const loadTasks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('tasks')
      .select('id, title, dropoff_lat, dropoff_lng, status')
      .eq('assigned_user_id', user.id)
      .in('status', ['assigned', 'en_route']);
    if (data) setTasks(data);
  };

  const toggleOnDuty = () => {
    setOnDuty(!onDuty);
    if (!onDuty) {
      setSpeed(null);
      setHeading(null);
    }
    toast.success(!onDuty ? 'Now on duty - tracking enabled' : 'Off duty - tracking disabled');
  };

  const centerOnLocation = useCallback(() => {
    if (mapRef.current && currentLocation) {
      mapRef.current.panTo(currentLocation);
      mapRef.current.setZoom(16);
    }
  }, [currentLocation]);

  const toggleMapType = useCallback(() => {
    setMapType(prev => prev === 'roadmap' ? 'satellite' : 'roadmap');
  }, []);

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
        {/* Map Container */}
        <div className="flex-1 relative">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 200px)' }}
            center={currentLocation || { lat: 0, lng: 0 }}
            zoom={15}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            mapTypeId={mapType}
            options={{
              disableDefaultUI: true,
              zoomControl: false,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: false,
            }}
          >
            {/* Driver's current location - Custom animated marker */}
            {currentLocation && (
              <DriverLocationMarker
                position={currentLocation}
                isTracking={isTracking}
                heading={heading}
              />
            )}

            {/* Task markers */}
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

          {/* Floating UI - On Duty Toggle */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
            <div className="pointer-events-auto">
              <Button
                size="lg"
                variant={onDuty ? 'default' : 'outline'}
                onClick={toggleOnDuty}
                className={cn(
                  "shadow-lg gap-2 transition-all duration-300",
                  onDuty && "btn-glow-active"
                )}
              >
                <Power className="h-5 w-5" />
                {onDuty ? 'On Duty' : 'Off Duty'}
              </Button>
            </div>
          </div>

          {/* Tasks Summary */}
          {tasks.length > 0 && (
            <div className="absolute top-20 left-4 pointer-events-auto">
              <Button
                variant="secondary"
                onClick={() => navigate('/app/tasks')}
                className="shadow-lg gap-2"
              >
                <Package className="h-5 w-5" />
                {tasks.length} Task{tasks.length !== 1 ? 's' : ''}
              </Button>
            </div>
          )}

          {/* Map Controls - Bottom Right */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-auto">
            <Button
              size="icon"
              variant="secondary"
              onClick={centerOnLocation}
              className="shadow-lg h-10 w-10"
              title="Center on my location"
            >
              <Crosshair className="h-5 w-5" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={toggleMapType}
              className="shadow-lg h-10 w-10"
              title="Toggle map type"
            >
              <Map className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Status Card */}
        <DriverStatusCard
          speed={speed}
          batteryLevel={batteryLevel}
          lastSyncTime={lastSyncTime || lastUpdate}
          isTracking={isTracking}
        />
      </div>
    </DriverAppLayout>
  );
}
