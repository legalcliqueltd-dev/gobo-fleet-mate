import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { useDeviceLocations } from '@/hooks/useDeviceLocations';
import { 
  Package, 
  MapPin,
  Users,
  Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import DeviceMarker from '@/components/map/DeviceMarker';

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
  
  const [recentTasks, setRecentTasks] = useState<TaskActivity[]>([]);
  const [activeTaskCount, setActiveTaskCount] = useState(0);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const { markers, items: devices, loading: devicesLoading } = useDeviceLocations();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    checkAdminAccess();
    loadDashboardData();
    
    // Set up real-time subscriptions
    const tasksChannel = supabase
      .channel('admin-tasks-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadRecentTasks)
      .subscribe();

    return () => {
      supabase.removeChannel(tasksChannel);
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
      loadRecentTasks(),
      loadActiveTaskCount(),
    ]);
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

  const loadActiveTaskCount = async () => {
    if (!user) return;
    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('created_by', user.id)
      .in('status', ['assigned', 'en_route']);
    
    setActiveTaskCount(count || 0);
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  const centerLocation = markers.length > 0 
    ? { lat: markers[0].latitude, lng: markers[0].longitude }
    : { lat: 37.7749, lng: -122.4194 }; // Default to San Francisco

  const activeDrivers = devices.filter(d => d.status === 'active' && !d.is_temporary).length;
  const onlineDevices = devices.filter(d => d.status !== 'offline').length;

  useEffect(() => {
    if (mapRef.current && markers.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      markers.forEach(m => bounds.extend({ lat: m.latitude, lng: m.longitude }));
      mapRef.current.fitBounds(bounds);
    }
  }, [markers]);

  return (
    <div className="h-screen flex flex-col">
      {/* Header Stats */}
      <div className="bg-background border-b p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Operations Overview</h1>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-background/50 backdrop-blur border border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{activeTaskCount}</p>
                  <p className="text-sm text-muted-foreground">Active Tasks</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-background/50 backdrop-blur border border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-8 w-8 text-emerald-500" />
                <div>
                  <p className="text-2xl font-bold">{activeDrivers}</p>
                  <p className="text-sm text-muted-foreground">Active Drivers</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-background/50 backdrop-blur border border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <Radio className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold">{onlineDevices}</p>
                  <p className="text-sm text-muted-foreground">Online Devices</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-background/50 backdrop-blur border border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <MapPin className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{devices.length}</p>
                  <p className="text-sm text-muted-foreground">Total Devices</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Main Content: Map and Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Center Map */}
        <div className="flex-1 relative">
          {devicesLoading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading devices...</p>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={centerLocation}
              zoom={markers.length > 0 ? 13 : 12}
              onLoad={(map) => {
                mapRef.current = map;
              }}
              options={{
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: true,
                styles: [
                  {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                  }
                ]
              }}
            >
              {/* Device Markers */}
              {markers.map((marker) => (
                <DeviceMarker
                  key={marker.device_id}
                  latitude={marker.latitude}
                  longitude={marker.longitude}
                  name={marker.name}
                  speed={marker.speed}
                  status={marker.status}
                  onClick={() => setSelectedDevice(marker.device_id)}
                />
              ))}

              {/* Compact Info Window for selected device - click to open, click elsewhere to close */}
              {selectedDevice && (() => {
                const device = markers.find(m => m.device_id === selectedDevice);
                if (!device) return null;
                return (
                  <InfoWindow
                    position={{ lat: device.latitude, lng: device.longitude }}
                    onCloseClick={() => setSelectedDevice(null)}
                    options={{ pixelOffset: new google.maps.Size(0, -20) }}
                  >
                    <div className="p-1.5 min-w-[120px]">
                      <p className="font-medium text-xs text-gray-900">{device.name}</p>
                      <p className="text-[10px] text-gray-600">
                        {device.speed || 0} km/h • {new Date(device.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <button
                        className="mt-1 w-full text-[10px] text-blue-600 hover:underline"
                        onClick={() => navigate(`/devices/${selectedDevice}`)}
                      >
                        Details →
                      </button>
                    </div>
                  </InfoWindow>
                );
              })()}
            </GoogleMap>
          )}
        </div>

        {/* Right Sidebar - Devices & Activity */}
        <div className="w-80 bg-background border-l overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Active Devices */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Active Devices</h2>
              <div className="space-y-2">
                {devices.filter(d => !d.is_temporary).length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No active devices
                  </p>
                ) : (
                  devices
                    .filter(d => !d.is_temporary)
                    .sort((a, b) => (a.status === 'active' ? -1 : 1))
                    .map((device) => (
                      <div
                        key={device.id}
                        className="cursor-pointer"
                        onClick={() => {
                          setSelectedDevice(device.id);
                          if (device.latest && mapRef.current) {
                            mapRef.current.panTo({
                              lat: device.latest.latitude,
                              lng: device.latest.longitude
                            });
                            mapRef.current.setZoom(16);
                          }
                        }}
                      >
                        <Card 
                          className={`transition-all bg-background/50 backdrop-blur border border-border ${
                            selectedDevice === device.id ? 'ring-2 ring-primary' : ''
                          }`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium">{device.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {device.latest ? 
                                    new Date(device.latest.timestamp).toLocaleTimeString() : 
                                    'No location data'}
                                </p>
                              </div>
                              <Badge variant={
                                device.status === 'active' ? 'default' : 
                                device.status === 'idle' ? 'secondary' : 
                                'outline'
                              }>
                                {device.status}
                              </Badge>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))
                )}
              </div>
            </div>

            {/* Recent Tasks */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold">Recent Tasks</h2>
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
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No recent tasks
                  </p>
                ) : (
                  recentTasks.map((task) => (
                    <Card key={task.id} className="bg-background/50 backdrop-blur border border-border">
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
    </div>
  );
}
