import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import LockedFeature from '@/components/LockedFeature';
import { Package, MapPin, Clock, FileText, Download, Plus, User, Play, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { useAdminTaskNotifications } from '@/hooks/useAdminTaskNotifications';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type Task = {
  id: string;
  title: string;
  description: string | null;
  assigned_driver_id: string | null;
  admin_code: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
  due_at: string | null;
  created_at: string;
  driver_name?: string;
};

type TaskReport = {
  id: string;
  task_id: string;
  delivered: boolean;
  receiver_name: string | null;
  verified_by: string | null;
  distance_to_dropoff_m: number | null;
  note: string | null;
  photos: string[] | null;
  created_at: string;
};

export default function TaskList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Record<string, TaskReport>>({});
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Subscribe to task completion alerts
  useAdminTaskNotifications();

  useEffect(() => {
    if (!user) return;
    loadTasks();
    const unsubscribe = subscribeToTasks();
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadTasks();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, user]);

  const loadTasks = async () => {
    if (!user) return;
    
    setLoading(true);

    // Get admin's connection codes
    const { data: devices } = await supabase
      .from('devices')
      .select('connection_code')
      .eq('user_id', user.id)
      .not('connection_code', 'is', null);

    const codes = devices?.map(d => d.connection_code).filter(Boolean) || [];

    // Build query
    let query = supabase
      .from('tasks')
      .select('*')
      .or(`created_by.eq.${user.id},admin_code.in.(${codes.join(',')})`)
      .order('created_at', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading tasks:', error);
      setLoading(false);
      return;
    }

    if (data) {
      // Enrich with driver names
      const enrichedTasks = await Promise.all(
        data.map(async (task) => {
          if (task.assigned_driver_id) {
            const { data: driver } = await supabase
              .from('drivers')
              .select('driver_name')
              .eq('driver_id', task.assigned_driver_id)
              .single();
            return { ...task, driver_name: driver?.driver_name || task.assigned_driver_id };
          }
          return task;
        })
      );

      setTasks(enrichedTasks);

      // Load reports for completed tasks
      const completedIds = enrichedTasks
        .filter(t => t.status === 'completed' || t.status === 'delivered')
        .map(t => t.id);

      if (completedIds.length > 0) {
        const { data: reportsData } = await supabase
          .from('task_reports')
          .select('*')
          .in('task_id', completedIds);

        if (reportsData) {
          const reportsMap: Record<string, TaskReport> = {};
          reportsData.forEach(r => {
            reportsMap[r.task_id] = r as unknown as TaskReport;
          });
          setReports(reportsMap);
        }
      }
    }

    setLoading(false);
  };

  const subscribeToTasks = () => {
    const channel = supabase
      .channel('admin-tasks')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'tasks',
      }, () => {
        loadTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'default';
      case 'en_route': return 'secondary';
      case 'completed':
      case 'delivered': return 'outline';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const exportToCSV = () => {
    const headers = ['Task ID', 'Title', 'Status', 'Driver', 'Created At', 'Delivered', 'Verified By', 'Distance (m)'];
    const rows = tasks.map(task => {
      const report = reports[task.id];
      return [
        task.id,
        task.title,
        task.status,
        task.driver_name || task.assigned_driver_id || '',
        new Date(task.created_at).toISOString(),
        report?.delivered ? 'Yes' : 'No',
        report?.verified_by || '',
        report?.distance_to_dropoff_m || '',
      ];
    });

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_${new Date().toISOString()}.csv`;
    link.click();
    toast.success('CSV exported');
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setDeleting(true);
    try {
      // Delete associated reports first (cascade)
      await supabase.from('task_reports').delete().eq('task_id', taskToDelete);
      // Then delete the task
      const { error } = await supabase.from('tasks').delete().eq('id', taskToDelete);
      if (error) throw error;
      toast.success('Task deleted');
      if (selectedTask?.id === taskToDelete) setSelectedTask(null);
      loadTasks();
    } catch (err: any) {
      console.error('Error deleting task:', err);
      toast.error('Failed to delete task');
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  };

  const openDeleteDialog = (taskId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
  };

  const pendingTasks = tasks.filter(t => t.status === 'assigned');
  const inProgressTasks = tasks.filter(t => t.status === 'en_route');
  // "Finished" = anything no longer live, including failed (previously
  // invisible on the board unless you used the filter dropdown).
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'delivered' || t.status === 'failed');

  // Bulk clear: finished tasks + their reports. Pending/in-progress are never touched.
  const handleClearCompleted = async () => {
    const ids = completedTasks.map(t => t.id);
    if (ids.length === 0) return;
    setClearing(true);
    try {
      await supabase.from('task_reports').delete().in('task_id', ids);
      const { error } = await supabase.from('tasks').delete().in('id', ids);
      if (error) throw error;
      toast.success(`Cleared ${ids.length} finished task${ids.length !== 1 ? 's' : ''}`);
      if (selectedTask && ids.includes(selectedTask.id)) setSelectedTask(null);
      loadTasks();
    } catch (err) {
      console.error('Error clearing tasks:', err);
      toast.error('Failed to clear finished tasks');
    } finally {
      setClearing(false);
      setClearDialogOpen(false);
    }
  };

  const TaskCard = ({ task, showReport = false }: { task: Task; showReport?: boolean }) => {
    const report = reports[task.id];
    return (
      <Card 
        key={task.id} 
        className={`cursor-pointer transition hover:shadow-lg ${selectedTask?.id === task.id ? 'ring-2 ring-primary' : ''}`}
        onClick={() => setSelectedTask(task)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <p className="font-medium flex-1 mr-2">{task.title}</p>
            <div className="flex items-center gap-1.5 shrink-0">
              {showReport ? (
                task.status === 'failed' ? (
                  <Badge variant="destructive">Failed</Badge>
                ) : (
                  <Badge variant="outline" className="text-success">✓ Done</Badge>
                )
              ) : (
                <Badge variant={getStatusColor(task.status)}>{task.status.replace('_', ' ')}</Badge>
              )}
              <button
                onClick={(e) => openDeleteDialog(task.id, e)}
                className="p-1 text-muted-foreground hover:text-destructive transition rounded"
                title="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          {task.driver_name && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <User className="h-3 w-3" />
              {task.driver_name}
            </div>
          )}
          {showReport && report?.photos && report.photos.length > 0 && (
            <div className="flex gap-1.5 mt-2">
              {report.photos.slice(0, 3).map((url, idx) => {
                const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('.webm');
                return isVideo ? (
                  <div key={idx} className="relative w-12 h-12 bg-black rounded-md overflow-hidden">
                    <Play className="absolute inset-0 m-auto h-4 w-4 text-white" />
                  </div>
                ) : (
                  <img key={idx} src={url} alt="" className="w-12 h-12 object-cover rounded-md border border-border" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                );
              })}
              {report.photos.length > 3 && (
                <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-muted text-xs font-medium">
                  +{report.photos.length - 3}
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
          </p>
        </CardContent>
      </Card>
    );
  };

  return (
    <LockedFeature featureName="Task Management">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Task Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Assign and track delivery tasks</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="en_route">En Route</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportToCSV}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          {completedTasks.length > 0 && (
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setClearDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Clear finished ({completedTasks.length})
            </Button>
          )}
          <Button onClick={() => navigate('/admin/tasks/new')}>
            <Plus className="h-4 w-4 mr-2" /> New Task
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
      ) : tasks.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No tasks yet</p>
            <Button onClick={() => navigate('/admin/tasks/new')}>
              <Plus className="h-4 w-4 mr-2" /> Create First Task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Tasks */}
          <div className="rounded-xl border border-warning/25 bg-warning/[0.04] p-3">
            <h2 className="mb-3 flex items-center justify-between border-b border-warning/20 pb-2">
              <span className="flex items-center gap-2 font-heading font-semibold">
                <Clock className="h-4 w-4 text-warning" />
                Waiting
              </span>
              <span className="rounded-full bg-warning/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-warning">
                {pendingTasks.length}
              </span>
            </h2>
            <div className="space-y-3">
              {pendingTasks.map(task => <TaskCard key={task.id} task={task} />)}
              {pendingTasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
                  Nothing waiting — create a task to dispatch a driver.
                </p>
              )}
            </div>
          </div>

          {/* In Progress */}
          <div className="rounded-xl border border-primary/25 bg-primary/[0.04] p-3">
            <h2 className="mb-3 flex items-center justify-between border-b border-primary/20 pb-2">
              <span className="flex items-center gap-2 font-heading font-semibold">
                <MapPin className="h-4 w-4 text-primary" />
                On the road
              </span>
              <span className="rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-primary">
                {inProgressTasks.length}
              </span>
            </h2>
            <div className="space-y-3">
              {inProgressTasks.map(task => <TaskCard key={task.id} task={task} />)}
              {inProgressTasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
                  Tasks move here when a driver taps Navigate and heads out.
                </p>
              )}
            </div>
          </div>

          {/* Finished — visually calm so live work pops */}
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <h2 className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <span className="flex items-center gap-2 font-heading font-semibold text-muted-foreground">
                <FileText className="h-4 w-4 text-success" />
                Finished
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                {completedTasks.length}
              </span>
            </h2>
            <div className="max-h-[600px] space-y-3 overflow-y-auto opacity-80">
              {completedTasks.map(task => <TaskCard key={task.id} task={task} showReport />)}
              {completedTasks.length === 0 && (
                <p className="rounded-lg border border-dashed border-border py-4 text-center text-sm text-muted-foreground">
                  Completed and failed tasks land here.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk clear confirmation */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Clear {completedTasks.length} finished task{completedTasks.length !== 1 ? 's' : ''}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All completed and failed tasks — including their delivery reports and proof photos —
              will be permanently deleted. Waiting and on-the-road tasks are not affected.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearCompleted}
              disabled={clearing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearing ? 'Clearing…' : 'Clear finished tasks'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Task Detail Modal */}
      {selectedTask && (
        <Card className="fixed bottom-24 left-4 right-4 max-w-lg mx-auto shadow-2xl z-40">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{selectedTask.title}</CardTitle>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openDeleteDialog(selectedTask.id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition rounded"
                  title="Delete task"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button onClick={() => setSelectedTask(null)} className="text-muted-foreground hover:text-foreground text-xl">×</button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedTask.description && (
              <p className="text-sm text-muted-foreground">{selectedTask.description}</p>
            )}
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant={getStatusColor(selectedTask.status)}>{selectedTask.status}</Badge>
              {selectedTask.driver_name && (
                <span className="flex items-center gap-1 text-muted-foreground">
                  <User className="h-3 w-3" /> {selectedTask.driver_name}
                </span>
              )}
            </div>

            {/* Show proof if available */}
            {reports[selectedTask.id] && (
              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-medium mb-2">Proof of Delivery</p>
                {reports[selectedTask.id].photos && reports[selectedTask.id].photos!.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {reports[selectedTask.id].photos!.map((url, idx) => {
                      const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('.webm');
                      return isVideo ? (
                        <video 
                          key={idx}
                          src={url}
                          controls
                          className="w-28 h-28 object-cover rounded-lg border border-border"
                        />
                      ) : (
                        <img 
                          key={idx}
                          src={url}
                          alt={`Proof ${idx + 1}`}
                          className="w-28 h-28 object-cover rounded-lg cursor-pointer border border-border hover:opacity-90 transition"
                          onClick={() => window.open(url, '_blank')}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      );
                    })}
                  </div>
                )}
                {reports[selectedTask.id].note && (
                  <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                    {reports[selectedTask.id].note}
                  </p>
                )}
                {reports[selectedTask.id].distance_to_dropoff_m !== null && (
                  <p className="text-xs text-muted-foreground mt-1">
                    📍 Completed {reports[selectedTask.id].distance_to_dropoff_m}m from dropoff
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this task and all associated reports/evidence. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTask}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </LockedFeature>
  );
}
