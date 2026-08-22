import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, CameraOff, CheckCircle2, Loader2, Package, Route as RouteIcon, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import { fetchDriverVisits, type StationVisit } from '@/integrations/supabase/stations';
import { cn } from '@/lib/utils';

type Totals = {
  stops: number;
  receipts: number;
  jobs: number;
  distanceKm: number;
  daysWorked: number;
};

/** Local YYYY-MM-DD so "this week" means his week, not UTC's. */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The driver's own record.
 *
 * Two things the app already knew but only ever showed the office:
 *
 *  • His week's work — stops made, jobs finished, distance covered, days
 *    worked. When pay is disputed, this is the answer, and it is his.
 *  • His proof — the station photos he submitted, with times. Every receipt
 *    he takes currently disappears into a hole he cannot look into; here it
 *    becomes his alibi against "you never went there".
 *
 * No new data is collected for this screen. It is the same records the
 * manager sees, turned to face the person who generated them — which is what
 * makes the tracking something he defends rather than resents.
 */
export default function DriverAppRecord() {
  const { session } = useDriverSession();

  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [loading, setLoading] = useState(true);

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const load = useCallback(async () => {
    if (!session?.driverId) return;
    setLoading(true);
    try {
      const [visitRows, historyRes, tasksRes] = await Promise.all([
        fetchDriverVisits(session.driverId, isoDay(weekStart)).catch(() => [] as StationVisit[]),
        supabase
          .from('driver_location_history')
          .select('latitude, longitude, recorded_at')
          .eq('driver_id', session.driverId)
          .gte('recorded_at', weekStart.toISOString())
          .order('recorded_at', { ascending: true }),
        supabase
          .from('tasks')
          .select('id, status, created_at')
          .eq('assigned_driver_id', session.driverId)
          .eq('status', 'completed')
          .gte('created_at', weekStart.toISOString()),
      ]);

      setVisits(visitRows);

      // Distance from the same fix history the office reads, summed simply.
      const fixes = (historyRes.data ?? []) as {
        latitude: number;
        longitude: number;
        recorded_at: string;
      }[];

      let distanceKm = 0;
      for (let i = 1; i < fixes.length; i++) {
        const a = fixes[i - 1];
        const b = fixes[i];
        const R = 6371;
        const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
        const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
        const lat1 = (a.latitude * Math.PI) / 180;
        const lat2 = (b.latitude * Math.PI) / 180;
        const h =
          Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
        const step = 2 * R * Math.asin(Math.sqrt(h));
        // Ignore GPS jumps; the same guard the server-side stats use.
        if (step < 5) distanceKm += step;
      }

      const days = new Set(fixes.map((f) => f.recorded_at.slice(0, 10)));

      setTotals({
        stops: visitRows.length,
        receipts: visitRows.filter((v) => v.status === 'completed').length,
        jobs: (tasksRes.data ?? []).length,
        distanceKm,
        daysWorked: days.size,
      });
    } catch (err) {
      console.warn('[DriverAppRecord] load failed:', err);
      setTotals(null);
    } finally {
      setLoading(false);
    }
  }, [session?.driverId, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DriverAppLayout>
      <div className="h-full overflow-y-auto px-4 py-5">
        <div className="mb-5">
          <p className="eyebrow mb-1">Last 7 days</p>
          <h1 className="font-heading text-2xl font-bold">My record</h1>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && totals && (
          <>
            {/* Work done */}
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div
                className="rounded-2xl border border-border bg-card p-4"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ShieldCheck className="h-4 w-4" />
                  <p className="text-[11px] font-medium uppercase tracking-wider">Stops made</p>
                </div>
                <p className="telemetry mt-2 text-2xl font-bold leading-none">{totals.stops}</p>
              </div>

              <div
                className="rounded-2xl border border-border bg-card p-4"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <p className="text-[11px] font-medium uppercase tracking-wider">Jobs done</p>
                </div>
                <p className="telemetry mt-2 text-2xl font-bold leading-none">{totals.jobs}</p>
              </div>

              <div
                className="rounded-2xl border border-border bg-card p-4"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <RouteIcon className="h-4 w-4" />
                  <p className="text-[11px] font-medium uppercase tracking-wider">Distance</p>
                </div>
                <p className="telemetry mt-2 text-2xl font-bold leading-none">
                  {totals.distanceKm.toFixed(0)}
                  <span className="ml-1 text-sm font-medium text-muted-foreground">km</span>
                </p>
              </div>

              <div
                className="rounded-2xl border border-border bg-card p-4"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4" />
                  <p className="text-[11px] font-medium uppercase tracking-wider">Days worked</p>
                </div>
                <p className="telemetry mt-2 text-2xl font-bold leading-none">{totals.daysWorked}</p>
              </div>
            </div>

            <p className="mb-7 text-xs leading-relaxed text-muted-foreground">
              These are your own figures, from the same records your manager sees. Useful if pay
              or hours are ever questioned.
            </p>

            {/* Proof */}
            <div className="mb-3 flex items-baseline justify-between">
              <p className="eyebrow">My proof</p>
              <p className="text-[11px] text-muted-foreground">
                <span className="telemetry font-semibold text-foreground">{totals.receipts}</span>{' '}
                receipt{totals.receipts === 1 ? '' : 's'} sent
              </p>
            </div>

            {visits.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <Camera className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">No station visits yet</p>
                <p className="max-w-[17rem] text-xs text-muted-foreground">
                  When you reach a station and send a photo, it is kept here as your proof that
                  you were there.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {visits.map((visit) => (
                  <li
                    key={visit.id}
                    className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
                    style={{ boxShadow: 'var(--shadow-card)' }}
                  >
                    {visit.photo_url ? (
                      <img
                        src={visit.photo_url}
                        alt="Your receipt"
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                        <CameraOff className="h-5 w-5 text-warning" />
                      </span>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {visit.status === 'completed' ? 'Proof sent' : 'Arrived — no photo'}
                      </p>
                      <p className="telemetry text-xs text-muted-foreground">
                        {format(new Date(visit.arrived_at), 'EEE d MMM, HH:mm')}
                      </p>
                    </div>

                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        visit.status === 'completed'
                          ? 'bg-success/10 text-success'
                          : 'bg-warning/10 text-warning'
                      )}
                    >
                      {visit.status === 'completed' ? 'Proven' : 'No photo'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </DriverAppLayout>
  );
}
