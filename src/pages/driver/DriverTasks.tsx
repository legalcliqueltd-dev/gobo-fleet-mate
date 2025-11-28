import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Package, MapPin, Clock, CheckCircle, XCircle, Navigation } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';

type Task = {
  id: string;
  title: string;
  description: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  dropoff_radius_m: number;
  due_at: string | null;
  status: string;
  created_at: string;
};

export default function DriverTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => console.error('Location error:', err)
      );
    }

    loadTasks();
    subscribeToTasks();
  }, []);

  const loadTasks = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_user_id', user.id)
      .in('status', ['assigned', 'en_route'])
      .order('due_at', { ascending: true, nullsFirst: false });

    if (!error && data) {
      setTasks(data);
    }
    setLoading(false);
  };

  const subscribeToTasks = () => {
    const channel = supabase
      .channel('driver-tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        () => {
          loadTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    const { error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId);

    if (error) {
      toast.error('Failed to update task status');
    } else {
      toast.success(`Task marked as ${status}`);
      loadTasks();
    }
  };

  const statusColor = {
    assigned: 'default',
    en_route: 'secondary',
    delivered: 'outline',
    failed: 'destructive',
    cancelled: 'outline',
  } as const;

  const statusIcon = {
    assigned: Package,
    en_route: Navigation,
    delivered: CheckCircle,
    failed: XCircle,
    cancelled: XCircle,
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">My Tasks</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Active Tasks</h3>
          <p className="text-muted-foreground">You're all caught up! New tasks will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => {
            const StatusIcon = statusIcon[task.status as keyof typeof statusIcon];
            const distanceToDropoff =
              userLocation && task.dropoff_lat && task.dropoff_lng
                ? calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    task.dropoff_lat,
                    task.dropoff_lng
                  )
                : null;

            return (
              <div
                key={task.id}
                className="glass-card rounded-xl p-6 hover:border-primary/50 transition cursor-pointer"
                onClick={() => navigate(`/tasks/${task.id}/complete`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <StatusIcon className="h-6 w-6 text-primary" />
                    <div>
                      <h3 className="font-semibold text-lg">{task.title}</h3>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusColor[task.status as keyof typeof statusColor]}>
                    {task.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm">
                  {task.dropoff_lat && task.dropoff_lng && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span>
                        Dropoff: {task.dropoff_lat.toFixed(6)}, {task.dropoff_lng.toFixed(6)}
                      </span>
                      {distanceToDropoff !== null && (
                        <span className="font-medium text-foreground">
                          ({(distanceToDropoff / 1000).toFixed(2)} km away)
                        </span>
                      )}
                    </div>
                  )}

                  {task.due_at && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Due: {new Date(task.due_at).toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-4">
                  {task.status === 'assigned' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateTaskStatus(task.id, 'en_route');
                      }}
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Start Trip
                    </Button>
                  )}
                  {task.status === 'en_route' && (
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/tasks/${task.id}/complete`);
                      }}
                    >
                      Complete Task
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
