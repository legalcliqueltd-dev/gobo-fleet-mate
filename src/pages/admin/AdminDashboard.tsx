import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { 
  Package, 
  MapPin 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { toast } from 'sonner';

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

  const centerLocation = { lat: 37.7749, lng: -122.4194 }; // Default to San Francisco

  return (
    <div className="h-screen flex flex-col">
      {/* Header Stats */}
      <div className="bg-background border-b p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Operations Overview</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card variant="glass">
              <CardContent className="p-4 flex items-center gap-3">
                <Package className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{activeTaskCount}</p>
                  <p className="text-sm text-muted-foreground">Active Tasks</p>
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
