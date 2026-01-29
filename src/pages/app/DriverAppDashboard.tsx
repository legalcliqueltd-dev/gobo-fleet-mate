import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBackgroundLocationTracking } from '@/hooks/useBackgroundLocationTracking';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { Navigation, Package, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import DriverAppLayout from '@/components/layout/DriverAppLayout';

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
  
  const { isTracking, batteryLevel } = useBackgroundLocationTracking(onDuty, {
    updateIntervalMs: 30000,
    batterySavingMode: true,
  });

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    // Get initial location
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

    loadTasks();
    
    // Subscribe to realtime updates
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
    toast.success(!onDuty ? 'Now on duty - tracking enabled' : 'Off duty - tracking disabled');
  };

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
      <div className="relative h-full w-full" style={{ minHeight: 'calc(100vh - 140px)' }}>
        {/* Map Container */}
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%', minHeight: 'calc(100vh - 140px)' }}
          center={currentLocation || { lat: 0, lng: 0 }}
          zoom={15}
          onLoad={(map) => {
            mapRef.current = map;
          }}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          {/* Driver's current location */}
          {currentLocation && (
            <Marker
              position={currentLocation}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 12,
                fillColor: '#3b82f6',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              }}
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
              className="shadow-lg gap-2"
            >
              <Power className="h-5 w-5" />
              {onDuty ? 'On Duty' : 'Off Duty'}
            </Button>
          </div>
          
          {isTracking && (
            <Badge variant="secondary" className="pointer-events-auto shadow-lg">
              <Navigation className="h-3 w-3 mr-1" />
              {batteryLevel}%
            </Badge>
          )}
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
      </div>
    </DriverAppLayout>
  );
}
