import { useCallback, useEffect, useState } from 'react';
import { Camera, Check, Loader2, MapPin, Navigation } from 'lucide-react';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import TaskNavigationMap from '@/components/map/TaskNavigationMap';
import ScreenHeader from '@/components/ScreenHeader';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
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

  const done = rows.filter((r) => r.done).length;
  const outstanding = rows.length - done;

  if (navigatingTo) {
    return (
      <TaskNavigationMap
        dropoffLat={navigatingTo.latitude}
        dropoffLng={navigatingTo.longitude}
        taskTitle={navigatingTo.name}
        station={{ kind: navigatingTo.kind, radiusM: navigatingTo.radius_m }}
        onClose={() => setNavigatingTo(null)}
      />
    );
  }

  return (
    // THE BUG THIS FIXES: this screen was built without the layout, so it
    // rendered with no bottom navigation at all — a driver who tapped
    // Stations could only leave it with the system back gesture.
    <DriverAppLayout>
      <div className="pb-6">
        <ScreenHeader
        eyebrow="Due today"
        title="Stations"
        count={loading ? null : outstanding}
        countLabel={outstanding === 1 ? 'to visit' : 'to visit'}
        done={done}
        total={rows.length}
      />

      {loading && (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="mt-12 flex flex-col items-center gap-3 px-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
            <MapPin className="h-7 w-7 text-accent-foreground" />
          </span>
          <p className="font-heading text-base font-bold">Nothing due today</p>
          <p className="max-w-[16rem] text-sm leading-relaxed text-muted-foreground">
            Your manager has not set any stations for today. They will appear
            here the moment one is.
          </p>
        </div>
      )}

      <ul className="mt-4 space-y-2.5 px-4">
        {rows.map(({ station, done: isDone, visit }) => {
          const needsReceipt = !isDone && Boolean(visit) && station.requires_photo;
          return (
            <li key={station.id}>
              <button
                type="button"
                onClick={() => setNavigatingTo(station)}
                className={cn(
                  'group relative flex w-full items-stretch gap-3.5 overflow-hidden rounded-2xl border border-border bg-card p-3.5 text-left transition-colors active:bg-muted',
                  isDone && 'opacity-60'
                )}
              >
                {/* A spine marks what is still owed. The station's stored
                    colour is NOT used here: rows saved before the rebrand hold
                    reds and violets, and red belongs to SOS alone. */}
                {!isDone && (
                  <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
                )}

                <span
                  className={cn(
                    'ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
                    isDone ? 'bg-success text-success-foreground' : 'bg-accent text-accent-foreground'
                  )}
                >
                  {isDone ? <Check className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
                </span>

                <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                  <span className="truncate font-heading text-[17px] font-bold leading-tight tracking-tight">
                    {station.name}
                  </span>

                  {/* Status is a solid chip, not grey prose — a driver reading
                      this at arm's length in sunlight gets the state from the
                      colour before he reads the word. */}
                  <span className="flex flex-wrap items-center gap-1.5">
                    {isDone ? (
                      <span className="inline-flex items-center rounded-md bg-success px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-success-foreground">
                        Done
                      </span>
                    ) : needsReceipt ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-warning px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-warning-foreground">
                        <Camera className="h-2.5 w-2.5" />
                        Receipt due
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-secondary-foreground">
                        Not yet
                      </span>
                    )}
                    {!isDone && station.requires_photo && !visit && (
                      <span className="text-[11px] text-muted-foreground">Photo needed on arrival</span>
                    )}
                  </span>
                </span>

                {/* Navigate: a target, not a chevron. Tapping the card does the
                    same thing, so this is signposting, not a second control. */}
                <span className="flex w-10 shrink-0 items-center justify-center self-center rounded-xl bg-primary/5 py-2.5 text-primary">
                  <Navigation className="h-4 w-4" />
                </span>
              </button>
            </li>
          );
        })}
        </ul>
      </div>
    </DriverAppLayout>
  );
}
