import { useMemo, useState } from 'react';
import { useTrips } from '../hooks/useTrips';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import { MapPin, Clock, TrendingUp, Gauge, Calendar, Filter } from 'lucide-react';
import { useDeviceLocations } from '../hooks/useDeviceLocations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function Trips() {
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const { trips, loading, error } = useTrips(selectedDeviceId);
  const { items: devices } = useDeviceLocations();

  const stats = useMemo(() => {
    const completed = trips.filter((t) => t.status === 'completed');
    const totalDistance = completed.reduce((sum, t) => sum + (t.distance_km || 0), 0);
    const totalDuration = completed.reduce((sum, t) => sum + (t.duration_minutes || 0), 0);
    const avgSpeed = completed.length > 0
      ? completed.reduce((sum, t) => sum + (t.avg_speed_kmh || 0), 0) / completed.length
      : 0;

    return {
      totalTrips: completed.length,
      totalDistance: totalDistance.toFixed(1),
      totalDuration: Math.round(totalDuration),
      avgSpeed: avgSpeed.toFixed(1),
    };
  }, [trips]);

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return '—';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trip History</h1>
          <p className="text-muted-foreground mt-1">
            Automatically detected trips with duration, distance, and speed metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedDeviceId || 'all'} onValueChange={(v) => setSelectedDeviceId(v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All devices" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All devices</SelectItem>
              {devices.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name || 'Unnamed device'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span className="text-sm">Total Trips</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalTrips}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">Total Distance</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalDistance} km</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Total Duration</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatDuration(stats.totalDuration)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Gauge className="h-4 w-4" />
              <span className="text-sm">Avg Speed</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgSpeed} km/h</div>
          </CardContent>
        </Card>
      </div>

      {/* Trips List */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Recent Trips</h2>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-center py-8 text-muted-foreground">Loading trips...</div>}
          {error && <div className="text-center py-8 text-destructive">{error}</div>}
          {!loading && trips.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No trips detected yet. Trips are automatically detected when devices start and stop moving.
            </div>
          )}

          <div className="space-y-4">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="rounded-lg border border-border p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold">{trip.device_name || 'Unknown device'}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(trip.start_time).toLocaleString()}
                    </div>
                  </div>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      trip.status === 'in_progress'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {trip.status === 'in_progress' ? 'In Progress' : 'Completed'}
                  </div>
                </div>

                {trip.status === 'completed' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Distance
                      </div>
                      <div className="font-medium mt-1">{trip.distance_km?.toFixed(2) || '—'} km</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Duration
                      </div>
                      <div className="font-medium mt-1">{formatDuration(trip.duration_minutes)}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Avg Speed
                      </div>
                      <div className="font-medium mt-1">{trip.avg_speed_kmh?.toFixed(1) || '—'} km/h</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground flex items-center gap-1">
                        <Gauge className="h-3 w-3" />
                        Max Speed
                      </div>
                      <div className="font-medium mt-1">{trip.max_speed_kmh?.toFixed(1) || '—'} km/h</div>
                    </div>
                  </div>
                )}

                {trip.status === 'in_progress' && (
                  <div className="text-sm text-muted-foreground">
                    Trip in progress...
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
