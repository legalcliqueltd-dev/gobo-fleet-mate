import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import AdvancedMarker from '@/components/map/AdvancedMarker';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';
import { Package, MapPin, User, Phone, Clock, FileText, Download } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner';

type Task = {
  id: string;
  title: string;
  description: string | null;
  assigned_user_id: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
  due_at: string | null;
  created_at: string;
};

type TaskReport = {
  id: string;
  task_id: string;
  delivered: boolean;
  receiver_name: string | null;
  receiver_phone: string | null;
  verified_by: string;
  latitude: number | null;
  longitude: number | null;
  distance_to_dropoff_m: number | null;
  note: string | null;
  signature_url: string | null;
  photos: string[];
  created_at: string;
};

export default function OpsTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Record<string, TaskReport>>({});
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    checkAdmin();
    loadTasks();
    subscribeToTasks();
  }, [filterStatus]);

  const checkAdmin = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    setIsAdmin(!!data);
  };

  const loadTasks = async () => {
    setLoading(true);
    let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

    if (filterStatus !== 'all') {
      query = query.eq('status', filterStatus);
    }

    const { data, error } = await query;

    if (!error && data) {
      setTasks(data);
      // Load reports for delivered tasks
      const deliveredTaskIds = data
        .filter((t) => t.status === 'delivered')
        .map((t) => t.id);
      if (deliveredTaskIds.length > 0) {
        loadReports(deliveredTaskIds);
      }
    }
    setLoading(false);
  };

  const loadReports = async (taskIds: string[]) => {
    const { data } = await supabase
      .from('task_reports')
      .select('*')
      .in('task_id', taskIds);

    if (data) {
      const reportsMap: Record<string, TaskReport> = {};
      data.forEach((report) => {
        reportsMap[report.task_id] = report as unknown as TaskReport;
      });
      setReports(reportsMap);
    }
  };

  const subscribeToTasks = () => {
    const channel = supabase
      .channel('ops-tasks')
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

  const exportToCSV = () => {
    const headers = [
      'Task ID',
      'Title',
      'Status',
      'Assigned User',
      'Created At',
      'Delivered',
      'Receiver',
      'Verified By',
      'Distance (m)',
    ];

    const rows = tasks.map((task) => {
      const report = reports[task.id];
      return [
        task.id,
        task.title,
        task.status,
        task.assigned_user_id,
        new Date(task.created_at).toISOString(),
        report?.delivered ? 'Yes' : 'No',
        report?.receiver_name || '',
        report?.verified_by || '',
        report?.distance_to_dropoff_m || '',
      ];
    });

    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tasks_${new Date().toISOString()}.csv`;
    link.click();
    toast.success('CSV exported');
  };

  const statusColor = {
    assigned: 'default',
    en_route: 'secondary',
    delivered: 'outline',
    failed: 'destructive',
    cancelled: 'outline',
  } as const;

  const centerLocation = selectedTask?.dropoff_lat && selectedTask?.dropoff_lng
    ? { latitude: selectedTask.dropoff_lat, longitude: selectedTask.dropoff_lng, zoom: 13 }
    : { latitude: 0, longitude: 0, zoom: 2 };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Task Management</h1>
        <div className="glass-card rounded-xl p-6">
          <p className="text-muted-foreground">Access denied. Admin role required.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Task Management</h1>
        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="en_route">En Route</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportToCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Tasks List */}
        <div className="glass-card rounded-xl p-4 overflow-y-auto">
          <h2 className="font-semibold mb-3">Tasks ({tasks.length})</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks found</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedTask?.id === task.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">{task.title}</span>
                    </div>
                    <Badge variant={statusColor[task.status as keyof typeof statusColor]}>
                      {task.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(task.created_at).toLocaleString()}
                  </p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Map & Details */}
        <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden relative">
          {!isLoaded ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: centerLocation.latitude, lng: centerLocation.longitude }}
              zoom={centerLocation.zoom}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
              }}
            >
              {tasks
                .filter((t) => t.dropoff_lat && t.dropoff_lng)
                .map((task) => (
                  <AdvancedMarker
                    key={task.id}
                    position={{ lat: task.dropoff_lat!, lng: task.dropoff_lng! }}
                    onClick={() => setSelectedTask(task)}
                    iconSize={32}
                  >
                    <div 
                      className="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center"
                      style={{ backgroundColor: task.status === 'delivered' ? '#22c55e' : task.status === 'en_route' ? '#eab308' : '#3b82f6' }}
                    />
                  </AdvancedMarker>
                ))}
            </GoogleMap>
          )}

          {/* Task Details Overlay */}
          {selectedTask && (
            <div className="absolute bottom-4 left-4 right-4 glass-card rounded-lg p-4 max-w-md max-h-[60%] overflow-y-auto">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">{selectedTask.title}</h3>
                <button
                  onClick={() => setSelectedTask(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              {selectedTask.description && (
                <p className="text-sm text-muted-foreground mb-3">{selectedTask.description}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant={statusColor[selectedTask.status as keyof typeof statusColor]}>
                    {selectedTask.status.replace('_', ' ').toUpperCase()}
                  </Badge>
                </div>

                {selectedTask.dropoff_lat && selectedTask.dropoff_lng && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>
                      {selectedTask.dropoff_lat.toFixed(6)}, {selectedTask.dropoff_lng.toFixed(6)}
                    </span>
                  </div>
                )}

                {selectedTask.due_at && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Due: {new Date(selectedTask.due_at).toLocaleString()}</span>
                  </div>
                )}

                {/* Report Details */}
                {reports[selectedTask.id] && (
                  <div className="mt-4 pt-4 border-t">
                    <h4 className="font-semibold mb-2">Proof of Delivery</h4>
                    {reports[selectedTask.id].receiver_name && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>{reports[selectedTask.id].receiver_name}</span>
                      </div>
                    )}
                    {reports[selectedTask.id].receiver_phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{reports[selectedTask.id].receiver_phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <FileText className="h-4 w-4" />
                      <span>Verified by: {reports[selectedTask.id].verified_by.toUpperCase()}</span>
                    </div>
                    {reports[selectedTask.id].distance_to_dropoff_m !== null && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        <span>Distance: {reports[selectedTask.id].distance_to_dropoff_m}m</span>
                      </div>
                    )}
                    {reports[selectedTask.id].note && (
                      <div className="mt-2 p-2 bg-muted rounded text-sm">
                        {reports[selectedTask.id].note}
                      </div>
                    )}
                    {reports[selectedTask.id].signature_url && (
                      <div className="mt-2">
                        <p className="text-xs font-medium mb-1">Signature:</p>
                        <img
                          src={reports[selectedTask.id].signature_url!}
                          alt="Signature"
                          className="border rounded max-h-20"
                        />
                      </div>
                    )}
                    {reports[selectedTask.id].photos.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium mb-1">
                          Photos ({reports[selectedTask.id].photos.length}):
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          {reports[selectedTask.id].photos.map((url: string, idx: number) => (
                            <img
                              key={idx}
                              src={url}
                              alt={`Photo ${idx + 1}`}
                              className="h-20 w-20 object-cover rounded border cursor-pointer"
                              onClick={() => window.open(url, '_blank')}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
