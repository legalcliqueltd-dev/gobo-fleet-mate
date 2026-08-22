import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MapPin,
  Route as RouteIcon,
  Share2,
  Users,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { useStationProgress } from '@/hooks/useStationProgress';
import { useFleetBreakdown } from '@/hooks/useFleetBreakdown';
import { Button } from '@/components/ui/button';
import { fetchFleetExpenses, formatMoney, summariseExpenses } from '@/integrations/supabase/expenses';
import { cn } from '@/lib/utils';

type DayCounts = {
  jobsDone: number;
  jobsOutstanding: number;
  alerts: number;
  alertsOpen: number;
  expenseTotal: number;
  expensePending: number;
  reportsOpen: number;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function Line({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  tone?: 'good' | 'warn';
}) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          tone === 'warn'
            ? 'bg-warning/15 text-warning'
            : tone === 'good'
              ? 'bg-success/15 text-success'
              : 'bg-muted text-muted-foreground'
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1 text-sm text-muted-foreground">{label}</span>
      <span className="telemetry shrink-0 text-sm font-bold text-foreground">{value}</span>
    </div>
  );
}

/**
 * Today, in one screen.
 *
 * The information already exists, spread across five tabs. At the end of a
 * shift a manager wants one answer — did today go to plan? — and assembling it
 * by hand from five places is exactly the chore that stops it being checked at
 * all. It is shareable as plain text, because the person who actually wants
 * this summary is often not the person holding the phone.
 */
export default function AdminAppDailyReport() {
  const navigate = useNavigate();
  const { codes, loading: codesLoading } = useAdminCodes();
  const { stations, summary: stationSummary } = useStationProgress(null);
  const { drivers, totals, loading: statsLoading } = useFleetBreakdown(1);

  const [counts, setCounts] = useState<DayCounts | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (codes.length === 0) {
      setCounts(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const since = startOfToday().toISOString();

      const [tasksRes, sosRes, expenses, reportsRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, status, created_at')
          .in('admin_code', codes),
        supabase
          .from('sos_events')
          .select('id, status, created_at')
          .in('admin_code', codes)
          .gte('created_at', since),
        fetchFleetExpenses(codes).catch(() => []),
        (supabase as any)
          .from('driver_reports')
          .select('id, status, created_at')
          .in('admin_code', codes)
          .gte('created_at', since),
      ]);

      const tasks = tasksRes.data ?? [];
      const todayExpenses = expenses.filter((e) => new Date(e.spent_at) >= startOfToday());
      const expenseSummary = summariseExpenses(todayExpenses);
      const sos = sosRes.data ?? [];

      setCounts({
        jobsDone: tasks.filter(
          (t) => t.status === 'completed' && new Date(t.created_at) >= startOfToday()
        ).length,
        jobsOutstanding: tasks.filter(
          (t) => !['completed', 'failed', 'cancelled'].includes(t.status)
        ).length,
        alerts: sos.length,
        alertsOpen: sos.filter((s) => s.status !== 'resolved' && s.status !== 'cancelled').length,
        expenseTotal: expenseSummary.total,
        expensePending: expenseSummary.pending,
        reportsOpen: ((reportsRes as any).data ?? []).filter(
          (r: { status: string }) => r.status !== 'resolved'
        ).length,
      });
    } catch (err) {
      console.warn('[AdminAppDailyReport] load failed:', err);
      setCounts(null);
    } finally {
      setLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  const activeDrivers = useMemo(
    () => drivers.filter((d) => d.points > 0).length,
    [drivers]
  );

  const asText = useMemo(() => {
    if (!counts || !totals) return '';
    return [
      `FleetTrackMate — ${format(new Date(), 'EEEE d MMMM yyyy')}`,
      '',
      `Drivers out: ${activeDrivers} of ${totals.driverCount}`,
      `Distance: ${totals.distanceKm.toFixed(1)} km`,
      `Stations: ${stationSummary.done} of ${stationSummary.total} done`,
      `Jobs completed: ${counts.jobsDone}`,
      `Jobs outstanding: ${counts.jobsOutstanding}`,
      `SOS alerts: ${counts.alerts}${counts.alertsOpen ? ` (${counts.alertsOpen} open)` : ''}`,
      `Expenses logged: ${formatMoney(counts.expenseTotal)}`,
      counts.reportsOpen ? `Open vehicle faults / problems: ${counts.reportsOpen}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [counts, totals, stationSummary, activeDrivers]);

  const share = async () => {
    if (!asText) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Daily fleet summary', text: asText });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(asText);
      toast.success('Summary copied');
    } catch {
      toast.error('Could not share the summary');
    }
  };

  const busy = loading || statsLoading;

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
        <p className="eyebrow mb-1">Summary</p>
        <h2 className="font-heading text-xl font-bold">{format(new Date(), 'EEEE d MMMM')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {busy && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pulling today together…
          </div>
        )}

        {!busy && counts && totals && (
          <>
            {/* The headline: did the round get done? */}
            <div
              className="mb-4 rounded-2xl border border-border bg-card p-5"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Stations visited
              </p>
              <p className="telemetry mt-1.5 text-3xl font-bold leading-none">
                {stationSummary.done}
                <span className="text-xl font-normal text-muted-foreground">
                  {' '}
                  / {stationSummary.total}
                </span>
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-success transition-all"
                  style={{
                    width: `${stationSummary.total ? (stationSummary.done / stationSummary.total) * 100 : 0}%`,
                  }}
                />
              </div>
              {stationSummary.outstanding > 0 && (
                <p className="mt-2 text-xs text-warning">
                  {stationSummary.outstanding} still outstanding
                </p>
              )}
            </div>

            <div
              className="divide-y divide-border rounded-2xl border border-border bg-card px-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <Line
                icon={Users}
                label="Drivers out today"
                value={`${activeDrivers} of ${totals.driverCount}`}
              />
              <Line
                icon={RouteIcon}
                label="Distance covered"
                value={`${totals.distanceKm.toFixed(1)} km`}
              />
              <Line
                icon={CheckCircle2}
                label="Jobs completed"
                value={String(counts.jobsDone)}
                tone={counts.jobsDone > 0 ? 'good' : undefined}
              />
              <Line
                icon={ClipboardList}
                label="Jobs still open"
                value={String(counts.jobsOutstanding)}
                tone={counts.jobsOutstanding > 0 ? 'warn' : undefined}
              />
              <Line
                icon={AlertTriangle}
                label="SOS alerts"
                value={
                  counts.alertsOpen ? `${counts.alerts} (${counts.alertsOpen} open)` : String(counts.alerts)
                }
                tone={counts.alertsOpen > 0 ? 'warn' : undefined}
              />
              <Line
                icon={Wallet}
                label="Expenses logged"
                value={formatMoney(counts.expenseTotal)}
                tone={counts.expensePending > 0 ? 'warn' : undefined}
              />
              {counts.reportsOpen > 0 && (
                <Line
                  icon={MapPin}
                  label="Open faults & problems"
                  value={String(counts.reportsOpen)}
                  tone="warn"
                />
              )}
            </div>

            <p className="px-1 py-5 text-center text-xs leading-relaxed text-muted-foreground">
              Covers midnight to now. Station and job figures come from the same records as the
              rest of the app.
            </p>
          </>
        )}

        {!busy && !counts && (
          <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Nothing to summarise yet — connect a driver to start collecting today's figures.
          </p>
        )}
      </div>

      <div
        className="border-t border-border bg-background px-4 py-3"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <Button className="h-12 w-full gap-2" disabled={!asText} onClick={share}>
          <Share2 className="h-4 w-4" />
          Share today's summary
        </Button>
      </div>
    </div>
  );
}
