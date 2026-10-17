import { useCallback, useEffect, useState } from 'react';
import { Camera, Check, Loader2, MapPin, Navigation } from 'lucide-react';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import TaskNavigationMap from '@/components/map/TaskNavigationMap';
import {
  fetchStationAssignments,
  fetchStationsForDriver,
  fetchTodayVisits,
  isDueToday,
  type Station,
  type StationVisit,
} from '@/integrations/supabase/stations';
import { cn } from '@/lib/utils';

type Row = { station: Station; visit: StationVisit | null; done: boolean };

/**
 * The places this driver owes a visit today. One of his two jobs, so it gets
 * a screen rather than a card buried under a map.
 *
 * Deliberately a LIST, not a map. A driver does not need to see the city to
 * know he still owes the depot — he needs to know what is left and in what
 * state. The map appears only when he taps a stop, because that is the only
 * moment it answers a question he actually has.
 *
 * No live position is read here. Geofencing and the dwell timer live in
 * useStationWatcher on the dashboard; this screen only asks what is owed,
 * which is two queries and no GPS.
 */
export default function DriverAppStations() {
  const { session } = useDriverSession();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigatingTo, setNavigatingTo] = useState<Station | null>(null);

  const load = useCallback(async () => {
    if (!session?.adminCode || !session?.driverId) return;
    try {
      const [stations, visits] = await Promise.all([
        fetchStationsForDriver(session.adminCode),
        fetchTodayVisits(session.driverId),
      ]);

      const due = stations.filter(isDueToday);
      const assignments = await fetchStationAssignments(due.map((s) => s.id)).catch(() => ({}));
      const mine = due.filter((s) => {
        const assigned = assignments[s.id] ?? [];
        return assigned.length === 0 || assigned.includes(session.driverId);
      });

      setRows(
        mine
          .map((station) => {
            const visit = visits.find((v) => v.station_id === station.id) ?? null;
            const done =
              visit?.status === 'completed' || (Boolean(visit) && !station.requires_photo);
            return { station, visit, done };
          })
          // What is still owed comes first. A finished stop is a receipt, not a task.
          .sort((a, b) => Number(a.done) - Number(b.done))
      );
    } catch (err) {
      console.error('[DriverAppStations] load failed:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [session?.adminCode, session?.driverId]);

  useEffect(() => {
    void load();
  }, [load]);

  const outstanding = rows.filter((r) => !r.done).length;

  if (navigatingTo) {
    return (
      <TaskNavigationMap
        dropoffLat={navigatingTo.latitude}
        dropoffLng={navigatingTo.longitude}
        taskTitle={navigatingTo.name}
        onClose={() => setNavigatingTo(null)}
      />
    );
  }

  return (
    <div className="px-4 py-5">
      <h1 className="font-heading text-2xl font-bold tracking-tight">Stations</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {loading
          ? 'Loading…'
          : rows.length === 0
            ? 'Nothing due today.'
            : outstanding === 0
              ? 'All done today.'
              : `${outstanding} still to visit`}
      </p>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="mt-10 flex flex-col items-center gap-2 px-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <MapPin className="h-6 w-6 text-muted-foreground" />
          </span>
          <p className="text-sm text-muted-foreground">
            Your manager has not set any stations for today.
          </p>
        </div>
      )}

      <ul className="mt-5 space-y-2">
        {rows.map(({ station, done, visit }) => (
          <li key={station.id}>
            <button
              type="button"
              onClick={() => setNavigatingTo(station)}
              className={cn(
                'flex w-full items-center gap-3.5 rounded-2xl border px-3.5 py-3.5 text-left transition-colors active:bg-muted',
                done ? 'border-border bg-card opacity-70' : 'border-border bg-card'
              )}
            >
              <span
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  done ? 'bg-success text-success-foreground' : 'bg-accent'
                )}
                style={done ? undefined : { backgroundColor: `${station.color}22` }}
              >
                {done ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <MapPin className="h-5 w-5" style={{ color: station.color }} />
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate font-heading text-base font-semibold">
                  {station.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {done
                    ? 'Done today'
                    : visit
                      ? 'Arrived — receipt still needed'
                      : station.requires_photo
                        ? 'Visit and take a photo'
                        : 'Visit required'}
                </span>
              </span>

              {!done && station.requires_photo && visit && (
                <Camera className="h-4 w-4 shrink-0 text-warning" />
              )}
              <Navigation className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
