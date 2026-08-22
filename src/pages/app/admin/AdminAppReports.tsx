import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ClipboardCheck,
  Loader2,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { Button } from '@/components/ui/button';
import {
  CHECK_ITEMS,
  PROBLEM_KINDS,
  fetchFleetReports,
  updateReportStatus,
  type DriverReport,
} from '@/integrations/supabase/reports';
import { cn } from '@/lib/utils';

/**
 * Vehicle checks and problems raised by drivers.
 *
 * Sorted so anything with a fault, or still open, surfaces first — a check
 * reading "all fine" is a record worth keeping, not something to read.
 */
export default function AdminAppReports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { codes, loading: codesLoading } = useAdminCodes();

  const [reports, setReports] = useState<DriverReport[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (codes.length === 0) {
      setReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchFleetReports(codes);
      setReports(rows);

      const ids = [...new Set(rows.map((r) => r.driver_id))];
      if (ids.length) {
        const { data } = await supabase
          .from('drivers')
          .select('driver_id, driver_name')
          .in('driver_id', ids);
        setNames(
          Object.fromEntries((data ?? []).map((d) => [d.driver_id, d.driver_name ?? 'Driver']))
        );
      }
    } catch (err) {
      console.error('[AdminAppReports] load failed:', err);
      toast.error('Could not load reports. Has the migration been run?');
    } finally {
      setLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  const sorted = useMemo(() => {
    const weight = (r: DriverReport) => {
      if (r.status === 'resolved') return 2;
      return r.has_fault || r.type === 'problem' ? 0 : 1;
    };
    return [...reports].sort((a, b) => weight(a) - weight(b));
  }, [reports]);

  const resolve = async (report: DriverReport) => {
    if (!user) return;
    setBusyId(report.id);
    try {
      await updateReportStatus(report.id, 'resolved', user.id);
      toast.success('Marked resolved');
      void load();
    } catch {
      toast.error('Could not update that report');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/app/admin/insights')}
          className="mb-1 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Insights
        </button>
        <p className="text-xs text-muted-foreground">
          Faults and problems appear first; clean checks are kept as a record.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ClipboardCheck className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="font-heading text-base font-semibold">Nothing reported</p>
            <p className="max-w-[17rem] text-sm text-muted-foreground">
              Drivers send vehicle checks at shift start, and problems from the road.
            </p>
          </div>
        )}

        <ul className="space-y-2.5">
          {sorted.map((report) => {
            const faults = Object.entries(report.details).filter(([, v]) => v === 'fault');
            const kind = PROBLEM_KINDS.find((k) => k.id === report.details.kind);
            const needsAction =
              report.status !== 'resolved' && (report.has_fault || report.type === 'problem');

            return (
              <li
                key={report.id}
                className={cn(
                  'rounded-2xl border p-4',
                  needsAction ? 'border-warning/40 bg-warning/5' : 'border-border bg-card'
                )}
                style={!needsAction ? { boxShadow: 'var(--shadow-card)' } : undefined}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                      needsAction ? 'bg-warning/20 text-warning' : 'bg-success/15 text-success'
                    )}
                  >
                    {report.type === 'problem' ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : (
                      <ShieldCheck className="h-5 w-5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {report.type === 'problem'
                        ? `${kind?.emoji ?? ''} ${kind?.label ?? 'Problem'}`
                        : report.has_fault
                          ? 'Vehicle check — fault'
                          : 'Vehicle check — all fine'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {names[report.driver_id] ?? report.driver_id} ·{' '}
                      {format(new Date(report.created_at), 'd MMM, HH:mm')}
                    </p>

                    {faults.length > 0 && (
                      <p className="mt-1.5 text-xs font-medium text-destructive">
                        {faults
                          .map(([id]) => CHECK_ITEMS.find((i) => i.id === id)?.label ?? id)
                          .join(', ')}
                      </p>
                    )}

                    {report.note && (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        {report.note}
                      </p>
                    )}

                    {report.photos.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        {report.photos.map((url) => (
                          <img
                            key={url}
                            src={url}
                            alt=""
                            className="h-16 w-16 rounded-lg object-cover"
                            loading="lazy"
                          />
                        ))}
                      </div>
                    )}

                    {report.latitude != null && report.longitude != null && (
                      <button
                        type="button"
                        onClick={() =>
                          window.open(
                            `https://www.google.com/maps/dir/?api=1&destination=${report.latitude},${report.longitude}`,
                            '_system'
                          )
                        }
                        className="mt-2 inline-flex min-h-[36px] items-center gap-1 text-xs font-medium text-primary"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Where it was raised
                      </button>
                    )}
                  </div>
                </div>

                {needsAction && (
                  <Button
                    className="mt-3.5 h-10 w-full gap-1.5 text-xs"
                    disabled={busyId === report.id}
                    onClick={() => resolve(report)}
                  >
                    {busyId === report.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Mark resolved
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
