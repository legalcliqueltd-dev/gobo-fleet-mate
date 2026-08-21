import { useCallback, useEffect, useState } from 'react';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { fetchStations, type Station } from '@/integrations/supabase/stations';

/**
 * The manager's stations, for drawing on any map they look at.
 *
 * Stations are context, not a separate screen: a vehicle's position only means
 * something relative to the places it is supposed to visit. Both dashboards —
 * app and website — use this so the two never show different sets.
 *
 * Failures are swallowed to an empty list on purpose. A deployment whose
 * migration has not been run yet must still render its live map; missing
 * stations should degrade the picture, never break it.
 */
export function useStationsForAdmin() {
  const { codes, loading: codesLoading } = useAdminCodes();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (codes.length === 0) {
      setStations([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await fetchStations(codes);
      setStations(rows.filter((s) => s.active));
    } catch (err) {
      console.warn('[useStationsForAdmin] stations unavailable:', err);
      setStations([]);
    } finally {
      setLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  return { stations, loading, refetch: load };
}
