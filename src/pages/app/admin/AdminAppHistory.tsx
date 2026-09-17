import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, History, Loader2, Route as RouteIcon, Search } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { Input } from '@/components/ui/input';
import { getDriverAccent } from '@/lib/driverAccent';
import { formatLastSeen } from '@/lib/driverStatus';
import { cn } from '@/lib/utils';

type Row = {
  driverId: string;
  name: string;
  lastSeen: string | null;
  distanceKm: number;
  points: number;
};

/** Metres between two fixes, for the day's distance. */
function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * History, by driver.
 *
 * Route replay used to be reachable only by remembering it lived inside a
 * driver's detail page — so "show me where someone went" meant guessing which
 * driver first. This is the front door: every driver, today's distance beside
 * each, and one tap into their day.
 */
export default function AdminAppHistory() {
  const navigate = useNavigate();
  const { codes, loading: codesLoading } = useAdminCodes();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (codes.length === 0) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data: drivers } = await supabase
        .from('drivers')
        .select('driver_id, driver_name, last_seen_at, status')
        .in('admin_code', codes)
        .neq('status', 'revoked');

      const since = new Date();
      since.setHours(0, 0, 0, 0);

      const { data: history } = await supabase
        .from('driver_location_history')
        .select('driver_id, latitude, longitude, recorded_at')
        .in('admin_code', codes)
        .gte('recorded_at', since.toISOString())
        .order('recorded_at', { ascending: true });

      // Sum today's distance per driver, rejecting the GPS jitter that would
      // otherwise credit a parked vehicle with kilometres it never drove.
      const byDriver = new Map<string, { lat: number; lng: number } | null>();
      const distance = new Map<string, number>();
      const points = new Map<string, number>();

      (history ?? []).forEach((fix) => {
        const prev = byDriver.get(fix.driver_id) ?? null;
        const here = { lat: fix.latitude, lng: fix.longitude };
        points.set(fix.driver_id, (points.get(fix.driver_id) ?? 0) + 1);
        if (prev) {
          const step = metres(prev, here);
          if (step > 15 && step < 5000) {
            distance.set(fix.driver_id, (distance.get(fix.driver_id) ?? 0) + step);
          }
        }
        byDriver.set(fix.driver_id, here);
      });

      setRows(
        (drivers ?? [])
          .map((d) => ({
            driverId: d.driver_id,
            name: d.driver_name?.trim() || 'Unnamed driver',
            lastSeen: d.last_seen_at,
            distanceKm: (distance.get(d.driver_id) ?? 0) / 1000,
            points: points.get(d.driver_id) ?? 0,
          }))
          .sort((a, b) => b.distanceKm - a.distanceKm || a.name.localeCompare(b.name))
      );
    } catch (err) {
      console.error('[AdminAppHistory] load failed:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const drove = rows.filter((r) => r.distanceKm > 0.1).length;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/app/admin/insights')}
          className="mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Insights
        </button>

        <p className="eyebrow mb-1">{format(new Date(), 'EEEE d MMMM')}</p>
        <h2 className="font-heading text-xl font-bold">History by driver</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {drove} of {rows.length} drove today · tap a driver to replay their day
        </p>

        {rows.length > 6 && (
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a driver"
              className="h-11 pl-10"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <History className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="font-heading text-base font-semibold">
              {query ? 'No driver by that name' : 'No drivers yet'}
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {visible.map((row) => (
            <li key={row.driverId}>
              <button
                type="button"
                onClick={() => navigate(`/app/admin/drivers/${row.driverId}/history`)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors active:bg-muted"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <span
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: getDriverAccent(row.driverId) }}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{row.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {row.points > 0
                      ? `${row.points} points · last seen ${formatLastSeen(row.lastSeen)}`
                      : `No movement today · last seen ${formatLastSeen(row.lastSeen)}`}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span
                    className={cn(
                      'telemetry block text-sm font-bold',
                      row.distanceKm > 0.1 ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {row.distanceKm.toFixed(1)}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">km today</span>
                </span>

                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>

        {!loading && rows.length > 0 && (
          <p className="flex items-center justify-center gap-1.5 px-4 py-6 text-center text-xs text-muted-foreground">
            <RouteIcon className="h-3.5 w-3.5" />
            Distance ignores GPS jitter, so a parked vehicle reads zero.
          </p>
        )}
      </div>
    </div>
  );
}
