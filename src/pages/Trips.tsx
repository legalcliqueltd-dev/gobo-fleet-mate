import { useMemo, useState } from 'react';
import { useTrips } from '../hooks/useTrips';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { MapPin, Clock, TrendingUp, Gauge, Calendar, Filter, Route, Car } from 'lucide-react';
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Trip History</h1>
          <p className="text-muted-foreground mt-1">
            Automatically detected trips with duration, distance, and speed metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedDeviceId || 'all'} onValueChange={(v) => setSelectedDeviceId(v === 'all' ? undefined : v)}>
            <SelectTrigger className="w-[200px] border-2">
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-card to-primary/5 border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Total Trips</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalTrips}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-primary/5 border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Total Distance</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalDistance} <span className="text-lg font-normal text-muted-foreground">km</span></div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-primary/5 border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Total Duration</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatDuration(stats.totalDuration)}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-card to-primary/5 border-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="p-2 rounded-lg bg-primary/10">
                <Gauge className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium">Avg Speed</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.avgSpeed} <span className="text-lg font-normal text-muted-foreground">km/h</span></div>
          </CardContent>
        </Card>
      </div>

      {/* Trips List */}
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Route className="h-5 w-5 text-primary" />
            Recent Trips
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading && (
            <div className="text-center py-12 text-muted-foreground">
              <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3" />
              Loading trips...
            </div>
          )}
          {error && <div className="text-center py-8 text-destructive">{error}</div>}
          {!loading && trips.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Car className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>No trips detected yet</p>
              <p className="text-sm mt-1">Trips are automatically detected when devices start and stop moving.</p>
            </div>
          )}

          <div className="space-y-4">
            {trips.map((trip) => (
              <div
                key={trip.id}
                className="rounded-xl border-2 p-5 hover:border-primary/30 hover:bg-accent/30 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Car className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold">{trip.device_name || 'Unknown device'}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="h-3 w-3" />
                        {new Date(trip.start_time).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                      trip.status === 'in_progress'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {trip.status === 'in_progress' ? '● In Progress' : 'Completed'}
                  </div>
                </div>

                {trip.status === 'completed' && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs flex items-center gap-1 mb-1">
                        <MapPin className="h-3 w-3" />
                        Distance
                      </div>
                      <div className="font-semibold">{trip.distance_km?.toFixed(2) || '—'} km</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs flex items-center gap-1 mb-1">
                        <Clock className="h-3 w-3" />
                        Duration
                      </div>
                      <div className="font-semibold">{formatDuration(trip.duration_minutes)}</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs flex items-center gap-1 mb-1">
                        <TrendingUp className="h-3 w-3" />
                        Avg Speed
                      </div>
                      <div className="font-semibold">{trip.avg_speed_kmh?.toFixed(1) || '—'} km/h</div>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <div className="text-muted-foreground text-xs flex items-center gap-1 mb-1">
                        <Gauge className="h-3 w-3" />
                        Max Speed
                      </div>
                      <div className="font-semibold">{trip.max_speed_kmh?.toFixed(1) || '—'} km/h</div>
                    </div>
                  </div>
                )}

                {trip.status === 'in_progress' && (
                  <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-2" />
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