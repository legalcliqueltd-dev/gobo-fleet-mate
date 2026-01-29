import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, MapPin, Clock, CheckCircle2 } from 'lucide-react';
import DriverAppLayout from '@/components/layout/DriverAppLayout';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTasks();
    
    const channel = supabase
      .channel('driver-app-tasks-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, loadTasks)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadTasks = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, description, dropoff_lat, dropoff_lng, status, due_at')
      .eq('assigned_user_id', user.id)
      .in('status', ['assigned', 'en_route', 'completed'])
      .order('due_at', { ascending: true });

    if (data) setTasks(data);
    setLoading(false);
  };

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
            {/* Active Tasks */}
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
                        
                        <Button
                          size="sm"
                          onClick={() => navigate(`/tasks/${task.id}/complete`)}
                        >
                          Complete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Completed Tasks */}
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
