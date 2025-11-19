import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { 
  AlertTriangle, 
  Users, 
  Package, 
  Activity,
  Bell,
  MapPin 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { toast } from 'sonner';

type DriverLocation = {
  driver_id: string;
  driver_name: string | null;
  latitude: number;
  longitude: number;
  last_update: string;
  status: string;
};

type SOSEvent = {
  id: string;
  user_id: string;
  hazard: string;
  latitude: number;
  longitude: number;
  status: string;
  created_at: string;
  message: string | null;
};

type TaskActivity = {
  id: string;
  title: string;
  status: string;
  assigned_user_id: string;
  updated_at: string;
  created_at: string;
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([]);
  const [sosEvents, setSosEvents] = useState<SOSEvent[]>([]);
  const [recentTasks, setRecentTasks] = useState<TaskActivity[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<DriverLocation | null>(null);
  const [driverCount, setDriverCount] = useState(0);
  const [activeTaskCount, setActiveTaskCount] = useState(0);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    checkAdminAccess();
    loadDashboardData();
    
    // Set up real-time subscriptions
    const sosChannel = supabase
      .channel('admin-sos-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_events' }, loadSOSEvents)
      .subscribe();

    const tasksChannel = supabase
      .channel('admin-tasks-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadRecentTasks)
      .subscribe();

    // Refresh driver locations every 10 seconds
    const locationInterval = setInterval(loadDriverLocations, 10000);

    return () => {
      supabase.removeChannel(sosChannel);
      supabase.removeChannel(tasksChannel);
      clearInterval(locationInterval);
    };
  }, []);

  const checkAdminAccess = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    
    if (!data) {
      toast.error('Admin access required');
      navigate('/dashboard');
    }
  };

  const loadDashboardData = async () => {
    await Promise.all([
      loadDriverLocations(),
      loadSOSEvents(),
      loadRecentTasks(),
      loadDriverCount(),
      loadActiveTaskCount(),
    ]);
  };

  const loadDriverLocations = async () => {
    if (!user) return;
    
    // Get connected drivers
    const { data: connections } = await supabase
      .from('driver_connections')
      .select('driver_user_id')
      .eq('admin_user_id', user.id)
      .eq('status', 'active');

    if (!connections || connections.length === 0) {
      setDriverLocations([]);
      return;
    }

    const driverIds = connections.map(c => c.driver_user_id);

    // Get their latest locations
    const { data: devices } = await supabase
      .from('devices')
      .select('id, user_id, name, status')
      .in('user_id', driverIds);

    if (!devices) return;

    const deviceIds = devices.map(d => d.id);

    // Get latest location for each device
    const { data: locations } = await supabase
      .from('locations')
      .select('device_id, latitude, longitude, timestamp')
      .in('device_id', deviceIds)
      .order('timestamp', { ascending: false });

    if (!locations) return;

    // Group by device_id and get most recent
    const latestLocations: Record<string, any> = {};
    locations.forEach(loc => {
      if (!latestLocations[loc.device_id]) {
        latestLocations[loc.device_id] = loc;
      }
    });

    // Map to driver locations
    const driverLocs: DriverLocation[] = devices
      .map(device => {
        const loc = latestLocations[device.id];
        if (!loc) return null;
        
        return {
          driver_id: device.user_id,
          driver_name: device.name,
          latitude: loc.latitude,
          longitude: loc.longitude,
          last_update: loc.timestamp,
          status: device.status || 'offline',
        };
      })
      .filter(Boolean) as DriverLocation[];

    setDriverLocations(driverLocs);
  };

  const loadSOSEvents = async () => {
    const { data } = await supabase
      .from('sos_events')
      .select('id, user_id, hazard, latitude, longitude, status, created_at, message')
      .in('status', ['open', 'acknowledged'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) setSosEvents(data);
  };

  const loadRecentTasks = async () => {
    if (!user) return;
    
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, assigned_user_id, updated_at, created_at')
      .eq('created_by', user.id)
      .order('updated_at', { ascending: false })
      .limit(10);

    if (data) setRecentTasks(data);
  };

  const loadDriverCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('driver_connections')
      .select('*', { count: 'exact', head: true })
      .eq('admin_user_id', user.id)
      .eq('status', 'active');
    
    setDriverCount(count || 0);
  };

  const loadActiveTaskCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .in('status', ['assigned', 'en_route']);
    
    setActiveTaskCount(count || 0);
  };

  const handleSOSClick = (sos: SOSEvent) => {
    navigate(`/admin/sos/${sos.id}`);
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const centerLocation = driverLocations.length > 0
    ? { lat: driverLocations[0].latitude, lng: driverLocations[0].longitude }
    : { lat: 0, lng: 0 };

  return (
    <div className="h-screen flex flex-col">
      {/* Header Stats */}
      <div className="bg-background border-b p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Fleet Overview</h1>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card variant="glass">
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{driverCount}</p>
                  <p className="text-sm text-muted-foreground">Active Drivers</p>
                </div>
              </CardContent>
            </Card>
            
            <Card variant="glass">
              <CardContent className="p-4 flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{activeTaskCount}</p>
                  <p className="text-sm text-muted-foreground">Active Tasks</p>
                </div>
              </CardContent>
            </Card>
            
            <Card variant="glass">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{sosEvents.length}</p>
                  <p className="text-sm text-muted-foreground">Active SOS</p>
                </div>
              </CardContent>
            </Card>
            
            <Card variant="glass">
              <CardContent className="p-4 flex items-center gap-3">
                <Activity className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{driverLocations.length}</p>
                  <p className="text-sm text-muted-foreground">Online Now</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content: Map and Sidebars */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - SOS Events */}
        <div className="w-80 bg-background border-r overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Active SOS
              </h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/admin/sos')}
              >
                View All
              </Button>
            </div>
            
            <div className="space-y-2">
              {sosEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No active SOS events
                </p>
              ) : (
                sosEvents.map((sos) => (
                  <div
                    key={sos.id}
                    className="cursor-pointer"
                    onClick={() => handleSOSClick(sos)}
                  >
                    <Card
                      variant="glass"
                      className="hover:border-red-500/50 transition-colors"
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge variant={sos.status === 'open' ? 'destructive' : 'secondary'}>
                              {sos.hazard}
                            </Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(sos.created_at).toLocaleTimeString()}
                            </p>
                            {sos.message && (
                              <p className="text-sm mt-1">{sos.message.substring(0, 50)}...</p>
                            )}
                          </div>
                          <MapPin className="h-4 w-4 text-red-500" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center Map */}
        <div className="flex-1 relative">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={centerLocation}
            zoom={12}
            onLoad={(map) => {
              mapRef.current = map;
            }}
            options={{
              disableDefaultUI: false,
              zoomControl: true,
              mapTypeControl: false,
              streetViewControl: false,
              fullscreenControl: true,
            }}
          >
            {/* Driver Markers */}
            {driverLocations.map((driver) => (
              <Marker
                key={driver.driver_id}
                position={{ lat: driver.latitude, lng: driver.longitude }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 8,
                  fillColor: driver.status === 'active' ? '#22c55e' : '#94a3b8',
                  fillOpacity: 1,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }}
                onClick={() => setSelectedDriver(driver)}
              />
            ))}

            {/* SOS Markers */}
            {sosEvents.map((sos) => 
              sos.latitude && sos.longitude ? (
                <Marker
                  key={sos.id}
                  position={{ lat: sos.latitude, lng: sos.longitude }}
                  icon={{
                    url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%23ef4444" stroke="%23ffffff" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><path d="M12 8v4M12 16h.01"></path></svg>',
                    scaledSize: new google.maps.Size(32, 32),
                  }}
                  onClick={() => handleSOSClick(sos)}
                />
              ) : null
            )}

            {/* Driver Info Window */}
            {selectedDriver && (
              <InfoWindow
                position={{ lat: selectedDriver.latitude, lng: selectedDriver.longitude }}
                onCloseClick={() => setSelectedDriver(null)}
              >
                <div className="p-2">
                  <h3 className="font-semibold">{selectedDriver.driver_name || 'Driver'}</h3>
                  <p className="text-xs text-muted-foreground">
                    Last update: {new Date(selectedDriver.last_update).toLocaleString()}
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline">
                      Assign Task
                    </Button>
                    <Button size="sm" variant="outline">
                      <Bell className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </div>

        {/* Right Sidebar - Recent Activity */}
        <div className="w-80 bg-background border-l overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Recent Activity</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/admin/tasks')}
              >
                View All
              </Button>
            </div>
            
            <div className="space-y-2">
              {recentTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No recent tasks
                </p>
              ) : (
                recentTasks.map((task) => (
                  <Card key={task.id} variant="glass">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={
                              task.status === 'delivered' ? 'default' : 
                              task.status === 'en_route' ? 'secondary' : 
                              'outline'
                            }>
                              {task.status}
                            </Badge>
                            <p className="text-xs text-muted-foreground">
                              {new Date(task.updated_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
