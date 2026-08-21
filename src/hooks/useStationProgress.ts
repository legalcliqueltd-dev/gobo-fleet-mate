import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import {
  fetchStationAssignments,
  fetchStations,
  fetchTodayVisitsForCodes,
  isDueToday,
  type Station,
  type StationVisit,
} from '@/integrations/supabase/stations';

/** Today's state of a station, from the manager's point of view. */
export type StationState = 'done' | 'arrived' | 'pending';

export type StationWithState = Station & {
  state: StationState;
  /** Drivers this station is narrowed to; empty means the whole fleet. */
  assignedTo: string[];
};

export const STATE_COLOR: Record<StationState, string> = {
  done: '#0b8f4f',
  arrived: '#c47d0a',
  pending: '#6b7280',
};

export const STATE_LABEL: Record<StationState, string> = {
  done: 'Receipt in',
  arrived: 'Arrived, no receipt',
  pending: 'Not yet',
};

/**
 * Today's station round, ready to draw on a live map.
 *
 * Answers the question a manager actually asks each day — "is the round
 * done?" — without making them open each station in turn. Colour carries the
 * answer: green means a receipt is in, amber means the driver was there but
 * never photographed, grey means not yet.
 *
 * Pass a driverId to scope it to one person: the stations they owe (their
 * assignments, or the whole fleet's if the station is unnarrowed) judged
 * against their own visits. Pass null and a station counts as done if anyone
 * completed it.
 *
 * Failures degrade to an empty list — the live map must render even where the
 * stations migration has not been applied.
 */
export function useStationProgress(driverId: string | null) {
  const { codes, loading: codesLoading } = useAdminCodes();

  const [stations, setStations] = useState<Station[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (codes.length === 0) {
      setStations([]);
      setVisits([]);
      setLoading(false);
      return;
    }
    try {
      const rows = (await fetchStations(codes)).filter((s) => s.active && isDueToday(s));
      setStations(rows);

      const [assignmentMap, visitRows] = await Promise.all([
        fetchStationAssignments(rows.map((s) => s.id)).catch(() => ({})),
        fetchTodayVisitsForCodes(codes).catch(() => [] as StationVisit[]),
      ]);
      setAssignments(assignmentMap);
      setVisits(visitRows);
    } catch (err) {
      console.warn('[useStationProgress] stations unavailable:', err);
      setStations([]);
      setVisits([]);
    } finally {
      setLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  const withState = useMemo<StationWithState[]>(() => {
    return stations
      .map((station) => {
        const assignedTo = assignments[station.id] ?? [];

        // Scoped to one driver: skip stations that belong to someone else.
        if (driverId && assignedTo.length > 0 && !assignedTo.includes(driverId)) return null;

        const relevant = visits.filter(
          (v) => v.station_id === station.id && (!driverId || v.driver_id === driverId)
        );

        const state: StationState = relevant.some((v) => v.status === 'completed')
          ? 'done'
          : relevant.length > 0
            ? // Arrival with no receipt only counts as outstanding when a
              // receipt was actually required; otherwise being there is the job.
              station.requires_photo
              ? 'arrived'
              : 'done'
            : 'pending';

        return { ...station, state, assignedTo };
      })
      .filter((s): s is StationWithState => s !== null);
  }, [stations, assignments, visits, driverId]);

  const summary = useMemo(() => {
    const done = withState.filter((s) => s.state === 'done').length;
    return { done, total: withState.length, outstanding: withState.length - done };
  }, [withState]);

  return { stations: withState, summary, loading, refetch: load };
}
