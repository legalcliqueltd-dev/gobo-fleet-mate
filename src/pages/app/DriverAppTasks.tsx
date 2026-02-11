import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, MapPin, Clock, CheckCircle2, Navigation } from 'lucide-react';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import TaskNavigationMap from '@/components/map/TaskNavigationMap';

type Task = {
  id: string;
  title: string;
  description: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
  due_at: string | null;
};

export default function DriverAppTasks() {
  const { session } = useDriverSession();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigatingTask, setNavigatingTask] = useState<Task | null>(null);

  const loadTasks = useCallback(async () => {
    if (!session?.driverId || !session?.adminCode) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'get-tasks',
          driverId: session.driverId,
          adminCode: session.adminCode,
          statuses: ['assigned', 'en_route', 'completed'],
        },
      });

      if (error) throw error;
      if (data?.tasks) setTasks(data.tasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.driverId, session?.adminCode]);

  useEffect(() => {
    loadTasks();
    // Poll every 15 seconds
    const interval = setInterval(loadTasks, 15000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadTasks(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadTasks]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-blue-500';
      case 'en_route': return 'bg-yellow-500';
      case 'completed': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDueDate = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    
    if (isToday) {
      return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const completedTasks = tasks.filter(t => t.status === 'completed');

  return (
    <DriverAppLayout>
      {navigatingTask && navigatingTask.dropoff_lat && navigatingTask.dropoff_lng && (
        <TaskNavigationMap
          dropoffLat={navigatingTask.dropoff_lat}
          dropoffLng={navigatingTask.dropoff_lng}
          taskTitle={navigatingTask.title}
          onClose={() => setNavigatingTask(null)}
        />
      )}

      <div className="p-4 space-y-6">
        <h1 className="text-2xl font-bold">My Tasks</h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">No tasks yet</h3>
              <p className="text-sm text-muted-foreground">
                Tasks assigned to you will appear here
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {activeTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Active ({activeTasks.length})
                </h2>
                {activeTasks.map((task) => (
                  <Card key={task.id} className="overflow-hidden">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${getStatusColor(task.status)}`} />
                            <h3 className="font-semibold truncate">{task.title}</h3>
                          </div>
                          
                          {task.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {task.description}
                            </p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {task.dropoff_lat && task.dropoff_lng && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                Drop-off set
                              </span>
                            )}
                            {task.due_at && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDueDate(task.due_at)}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex gap-2">
                          {task.dropoff_lat && task.dropoff_lng && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNavigatingTask(task);
                              }}
                            >
                              <Navigation className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() => navigate(`/app/tasks/${task.id}/complete`)}
                          >
                            Complete
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  Completed ({completedTasks.length})
                </h2>
                {completedTasks.slice(0, 5).map((task) => (
                  <Card key={task.id} className="opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                        <span className="font-medium truncate">{task.title}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DriverAppLayout>
  );
}
