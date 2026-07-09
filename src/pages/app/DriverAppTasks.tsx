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

  const getStatusMeta = (status: string) => {
    switch (status) {
      case 'assigned': return { dot: 'bg-primary', label: 'Assigned' };
      case 'en_route': return { dot: 'bg-warning', label: 'En route' };
      case 'completed': return { dot: 'bg-success', label: 'Done' };
      default: return { dot: 'bg-muted-foreground', label: status };
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
        <div>
          <p className="eyebrow mb-1">Today's work</p>
          <h1 className="font-heading text-2xl font-bold">My tasks</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">Loading tasks…</p>
          </div>
        ) : tasks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
                <Package className="h-7 w-7 text-accent-foreground" />
              </div>
              <h3 className="mb-1 font-heading font-semibold">No tasks yet</h3>
              <p className="text-sm text-muted-foreground">
                Tasks your dispatcher assigns to you will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {activeTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Active · {activeTasks.length}
                </h2>
                {activeTasks.map((task) => {
                  const status = getStatusMeta(task.status);
                  return (
                    <Card key={task.id} className="overflow-hidden">
                      <CardContent className="p-4">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${status.dot} ${task.status === 'en_route' ? 'animate-pulse' : ''}`} />
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                            {status.label}
                          </span>
                        </div>
                        <h3 className="mb-1 font-heading text-lg font-semibold leading-tight">{task.title}</h3>

                        {task.description && (
                          <p className="mb-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {task.dropoff_lat && task.dropoff_lng && (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              Drop-off set
                            </span>
                          )}
                          {task.due_at && (
                            <span className="telemetry flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDueDate(task.due_at)}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          {task.dropoff_lat && task.dropoff_lng && (
                            <Button
                              variant="outline"
                              className="h-11 flex-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNavigatingTask(task);
                              }}
                            >
                              <Navigation className="mr-2 h-4 w-4" />
                              Navigate
                            </Button>
                          )}
                          <Button
                            className="h-11 flex-1"
                            onClick={() => navigate(`/app/tasks/${task.id}/complete`)}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Complete
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="font-mono text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
                  Completed · {completedTasks.length}
                </h2>
                {completedTasks.slice(0, 5).map((task) => (
                  <Card key={task.id} className="opacity-60">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-success" />
                        <span className="truncate font-medium">{task.title}</span>
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
