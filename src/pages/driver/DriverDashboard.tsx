import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBackgroundLocationTracking } from '@/hooks/useBackgroundLocationTracking';
import { GoogleMap, useJsApiLoader, Marker, Polygon } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { AlertCircle, Navigation, Package, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type Task = {
  id: string;
  title: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
};

type SOSEvent = {
  id: string;
  latitude: number;
  longitude: number;
  hazard: string;
  status: string;
  created_at: string;
};

type Geofence = {
  id: string;
  name: string;
  coordinates: Array<{ lat: number; lng: number }>;
  type: string;
};

export default function DriverDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sosEvents, setSosEvents] = useState<SOSEvent[]>([]);
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [onDuty, setOnDuty] = useState(false);
  const [sosHolding, setSosHolding] = useState(false);
  const [sosCountdown, setSosCountdown] = useState(3);
  
  const holdTimerRef = useRef<number | null>(null);
  
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
    loadSosEvents();
    loadGeofences();
    
    // Subscribe to realtime updates
    const tasksChannel = supabase
      .channel('driver-dashboard-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadTasks)
      .subscribe();

    const sosChannel = supabase
      .channel('driver-dashboard-sos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_events' }, loadSosEvents)
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
      supabase.removeChannel(sosChannel);
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
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

  const loadSosEvents = async () => {
    // Load nearby active SOS events (within 50km radius - approximate)
    const { data } = await supabase
      .from('sos_events')
      .select('id, latitude, longitude, hazard, status, created_at')
      .eq('status', 'open')
      .limit(10);
    if (data) setSosEvents(data);
  };

  const loadGeofences = async () => {
    // Load geofences - assuming a geofences table exists
    // This is a placeholder implementation
    setGeofences([]);
  };

  const handleSosPress = () => {
    setSosHolding(true);
    setSosCountdown(3);
    
    holdTimerRef.current = window.setInterval(() => {
      setSosCountdown((prev) => {
        if (prev <= 1) {
          if (holdTimerRef.current) clearInterval(holdTimerRef.current);
          setSosHolding(false);
          navigate('/driver/sos');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSosRelease = () => {
    if (holdTimerRef.current) clearInterval(holdTimerRef.current);
    setSosHolding(false);
    setSosCountdown(3);
  };

  const toggleOnDuty = () => {
    setOnDuty(!onDuty);
    toast.success(!onDuty ? 'Now on duty - tracking enabled' : 'Off duty - tracking disabled');
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-full">
      {/* Map Container */}
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={currentLocation || { lat: 0, lng: 0 }}
        zoom={15}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        options={{
          disableDefaultUI: false,
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
              scale: 10,
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
              onClick={() => navigate(`/driver/tasks/${task.id}`)}
            />
          ) : null
        )}

        {/* SOS event markers */}
        {sosEvents.map((sos) => (
          <Marker
            key={sos.id}
            position={{ lat: sos.latitude, lng: sos.longitude }}
            icon={{
              url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%23ef4444" stroke="%23ffffff" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><path d="M12 8v4M12 16h.01"></path></svg>',
              scaledSize: new google.maps.Size(32, 32),
            }}
          />
        ))}

        {/* Geofence polygons */}
        {geofences.map((geofence) => (
          <Polygon
            key={geofence.id}
            paths={geofence.coordinates}
            options={{
              fillColor: geofence.type === 'restricted' ? '#ef4444' : '#22c55e',
              fillOpacity: 0.2,
              strokeColor: geofence.type === 'restricted' ? '#ef4444' : '#22c55e',
              strokeWeight: 2,
            }}
          />
        ))}
      </GoogleMap>

      {/* Floating UI Elements */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto">
          <Button
            size="lg"
            variant={onDuty ? 'default' : 'outline'}
            onClick={toggleOnDuty}
            className="shadow-lg"
          >
            <Navigation className="h-5 w-5 mr-2" />
            {onDuty ? 'On Duty' : 'Off Duty'}
          </Button>
          {isTracking && (
            <Badge variant="secondary" className="ml-2">
              Battery: {batteryLevel}%
            </Badge>
          )}
        </div>
        
        <Button
          size="icon"
          variant="outline"
          onClick={() => navigate('/driver/settings')}
          className="pointer-events-auto shadow-lg"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      {/* Tasks Summary */}
      {tasks.length > 0 && (
        <div className="absolute top-20 left-4 pointer-events-auto">
          <Button
            variant="secondary"
            onClick={() => navigate('/driver/tasks')}
            className="shadow-lg"
          >
            <Package className="h-5 w-5 mr-2" />
            {tasks.length} Active Task{tasks.length !== 1 ? 's' : ''}
          </Button>
        </div>
      )}

      {/* SOS Button */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 pointer-events-auto">
        <button
          onMouseDown={handleSosPress}
          onMouseUp={handleSosRelease}
          onTouchStart={handleSosPress}
          onTouchEnd={handleSosRelease}
          className={`
            relative w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-red-600
            shadow-2xl transition-all duration-200 active:scale-95
            flex items-center justify-center
            ${sosHolding ? 'animate-pulse scale-110' : ''}
          `}
        >
          <AlertCircle className="h-12 w-12 text-white" />
          {sosHolding && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{sosCountdown}</span>
            </div>
          )}
        </button>
        <p className="text-center text-sm text-muted-foreground mt-2 font-medium">
          Hold for SOS
        </p>
      </div>

      {/* Active SOS Events Badge */}
      {sosEvents.length > 0 && (
        <div className="absolute bottom-8 right-4 pointer-events-auto">
          <Badge variant="destructive" className="text-lg px-4 py-2">
            {sosEvents.length} Active SOS
          </Badge>
        </div>
      )}
    </div>
  );
}
