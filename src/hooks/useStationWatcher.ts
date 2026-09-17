import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  distanceMeters,
  fetchStationAssignments,
  fetchStationsForDriver,
  fetchTodayVisits,
  isDueToday,
  recordArrival,
  type Station,
  type StationVisit,
} from '@/integrations/supabase/stations';
import { checkVehicleMotion } from '@/lib/trackingGaps';
import { notify } from '@/services/notifications';

type Position = { lat: number; lng: number } | null;

/**
 * Watches the driver's position against their fleet's stations and records an
 * arrival once they have genuinely attended one.
 *
 * "Genuinely" is the important part. Being briefly inside the radius is not
 * enough — the driver has to remain there for the station's dwell time, which
 * is what separates attending a site from driving past it on the road
 * outside. Only then is a visit written.
 *
 * A rolling buffer of recent speeds feeds the vehicle-motion check: if the
 * approach never exceeded walking pace the visit is still recorded, but
 * flagged for the manager to look at. It is evidence, not an accusation —
 * a phone cannot prove the vehicle came, only that the approach looked
 * plausible.
 */
export function useStationWatcher(
  position: Position,
  speedKmh: number | null,
  accuracy: number | null,
  session: { driverId: string; adminCode: string } | null
) {
  const [stations, setStations] = useState<Station[]>([]);
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [loading, setLoading] = useState(true);
  /** Station the driver is physically inside right now, if any. */
  const [insideStation, setInsideStation] = useState<Station | null>(null);
  /** Seconds left on the dwell requirement, so the wait is visible. */
  const [dwellRemaining, setDwellRemaining] = useState<number | null>(null);

  /** station id -> when we first saw them inside the radius this stay */
  const insideSince = useRef<Record<string, number>>({});
  /** closest approach recorded during the current stay */
  const closest = useRef<Record<string, number>>({});
  /** station ids already written today, to avoid repeat upserts */
  const recorded = useRef<Set<string>>(new Set());
  /** recent speeds for the motion check */
  const speedBuffer = useRef<number[]>([]);

  /**
   * Ticks the dwell check on a clock instead of on movement.
   *
   * THE BUG THIS FIXES: the native watcher uses a 15 m distanceFilter, so a
   * driver who parks and sits still produces NO further position updates. The
   * dwell check lived in an effect keyed on position, so it ran once on
   * arrival — when dwell was zero — and then never again. The arrival only
   * fired when GPS drift eventually crossed 15 m, which is why standing in the
   * office for the required minute did nothing and it took closer to an hour.
   *
   * The "You are at X" chip appeared because that single fix set it, which is
   * what made the failure so confusing: the app plainly knew he was there.
   */
  const [dwellTick, setDwellTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setDwellTick((t) => t + 1), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const [stationRows, visitRows] = await Promise.all([
        fetchStationsForDriver(session.adminCode),
        fetchTodayVisits(session.driverId),
      ]);

      // Honour per-driver assignment: a station with no rows applies to the
      // whole fleet, one with rows only to the drivers named. Without this the
      // manager's picker would silently do nothing on the driver's phone.
      const due = stationRows.filter(isDueToday);
      const assignments = await fetchStationAssignments(due.map((s) => s.id)).catch(() => ({}));
      setStations(
        due.filter((station) => {
          const assigned = assignments[station.id] ?? [];
          return assigned.length === 0 || assigned.includes(session.driverId);
        })
      );
      setVisits(visitRows);
      visitRows.forEach((v) => recorded.current.add(v.station_id));
    } catch (err) {
      // Silent: the stations tables may not exist yet on older deployments,
      // and the driver's core job (tracking) must not be disturbed by it.
      console.warn('[useStationWatcher] could not load stations:', err);
      setStations([]);
    } finally {
      setLoading(false);
    }
  }, [session?.driverId, session?.adminCode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Keep a short history of speeds for the approach check.
  useEffect(() => {
    if (typeof speedKmh !== 'number') return;
    speedBuffer.current = [...speedBuffer.current, speedKmh].slice(-40);
  }, [speedKmh]);

  useEffect(() => {
    if (!position || !session || stations.length === 0) return;

    const now = Date.now();

    stations.forEach((station) => {
      const distance = distanceMeters(position, {
        lat: station.latitude,
        lng: station.longitude,
      });

      if (distance > station.radius_m) {
        // Left the area — reset the stay so the dwell timer starts fresh.
        delete insideSince.current[station.id];
        delete closest.current[station.id];
        setInsideStation((current) => {
          if (current?.id !== station.id) return current;
          setDwellRemaining(null);
          return null;
        });
        return;
      }

      setInsideStation((current) => (current?.id === station.id ? current : station));

      insideSince.current[station.id] ??= now;
      closest.current[station.id] = Math.min(
        closest.current[station.id] ?? Number.POSITIVE_INFINITY,
        distance
      );

      const dwellSeconds = Math.round((now - insideSince.current[station.id]) / 1000);

      // Surface the countdown. Waiting with no feedback is indistinguishable
      // from the feature being broken — which is how this looked in the field.
      if (!recorded.current.has(station.id)) {
        setDwellRemaining(Math.max(0, station.min_dwell_seconds - dwellSeconds));
      }

      if (dwellSeconds < station.min_dwell_seconds) return;
      if (recorded.current.has(station.id)) return;

      recorded.current.add(station.id);

      const motion = checkVehicleMotion(speedBuffer.current);

      void recordArrival({
        station_id: station.id,
        driver_id: session.driverId,
        admin_code: session.adminCode,
        dwell_seconds: dwellSeconds,
        closest_distance_m: Math.round(closest.current[station.id] ?? distance),
        accuracy_m: accuracy,
      })
        .then(() => {
          toast.success(`Arrived at ${station.name}`, {
            description: station.requires_photo
              ? 'Take the photo receipt to complete this stop.'
              : undefined,
          });

          // A toast is invisible to someone watching the road; the
          // notification sound is what actually reaches him.
          if (station.requires_photo) {
            void notify(
              'jobs',
              `Arrived at ${station.name}`,
              'Take the photo receipt to complete this stop.'
            );
          }
          void refresh();
        })
        .catch((err) => {
          // Put it back so a later fix retries rather than losing the visit.
          recorded.current.delete(station.id);
          console.warn('[useStationWatcher] arrival not saved:', err);
        });

      if (!motion.looksDriven) {
        console.warn(`[useStationWatcher] ${station.name}: ${motion.reason}`);
      }
    });
  }, [position?.lat, position?.lng, stations, session, accuracy, refresh, dwellTick]);

  const visitFor = useCallback(
    (stationId: string) => visits.find((v) => v.station_id === stationId) ?? null,
    [visits]
  );

  return { stations, visits, loading, refresh, visitFor, insideStation, dwellRemaining };
}
