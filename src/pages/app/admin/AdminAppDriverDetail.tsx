import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  Gauge,
  History,
  Loader2,
  MapPin,
  Navigation,
  Package,
  Plus,
  Route as RouteIcon,
  SignalZero,
  Timer,
  TrendingUp,
  Unlink,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDriverInsights, getTimeRange } from '@/hooks/useDriverInsights';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getDriverAccent } from '@/lib/driverAccent';
import {
  formatLastSeen,
  getVehicleStatus,
  STATUS_CLASSES,
  STATUS_LABEL,
} from '@/lib/driverStatus';
import {
  coveragePercent,
  findOpenGap,
  findTrackingGaps,
  formatGapDuration,
  type TrackingGap,
} from '@/lib/trackingGaps';
import { cn } from '@/lib/utils';

type DriverRow = {
  driver_id: string;
  driver_name: string | null;
  admin_code: string;
  status: string | null;
  last_seen_at: string | null;
  connected_at: string | null;
};

type LocationRow = {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  updated_at: string | null;
};

type TaskRow = {
  id: string;
  title: string;
  status: string;
  created_at: string;
};

const RANGES = [
  { id: '1h', label: '1 h' },
  { id: '4h', label: '4 h' },
  { id: '24h', label: '24 h' },
  { id: '7d', label: '7 d' },
];

function Stat({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: typeof Gauge;
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <p className="truncate text-[10px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="telemetry mt-1.5 text-xl font-bold leading-none text-foreground">
        {value}
        {unit && <span className="ml-1 text-xs font-medium text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

/**
 * Everything the manager needs about one driver, on a phone: who they are,
 * where they are, how they have been driving, and what they are carrying —
 * plus the two actions worth taking from here (assign a job, get directions).
 */
export default function AdminAppDriverDetail() {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();

  const [driver, setDriver] = useState<DriverRow | null>(null);
  const [location, setLocation] = useState<LocationRow | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('24h');
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [gaps, setGaps] = useState<TrackingGap[]>([]);
  const [openGap, setOpenGap] = useState<TrackingGap | null>(null);

  const since = useMemo(() => getTimeRange(range), [range]);
  const { data: insights, isLoading: insightsLoading } = useDriverInsights(driverId, since);

  useEffect(() => {
    if (!driverId) return;

    void (async () => {
      setLoading(true);
      try {
        const [driverRes, locationRes, tasksRes] = await Promise.all([
          supabase.from('drivers').select('*').eq('driver_id', driverId).maybeSingle(),
          supabase
            .from('driver_locations')
            .select('latitude, longitude, speed, accuracy, updated_at')
            .eq('driver_id', driverId)
            .maybeSingle(),
          supabase
            .from('tasks')
            .select('id, title, status, created_at')
            .eq('assigned_driver_id', driverId)
            .order('created_at', { ascending: false })
            .limit(10),
        ]);

        setDriver((driverRes.data as DriverRow) ?? null);
        setLocation((locationRes.data as LocationRow) ?? null);
        setTasks((tasksRes.data ?? []) as TaskRow[]);

        // Tracking gaps: derived from the raw fix history, so a phone that was
        // switched off shows up as an explicit hole rather than looking like a
        // quiet period parked somewhere.
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: history } = await supabase
          .from('driver_location_history')
          .select('recorded_at')
          .eq('driver_id', driverId)
          .gte('recorded_at', since)
          .order('recorded_at', { ascending: true });

        const fixes = (history ?? [])
          .filter((row) => Boolean(row.recorded_at))
          .map((row) => ({ timestamp: row.recorded_at as string }));
        setGaps(findTrackingGaps(fixes));
        setOpenGap(findOpenGap(fixes));
      } catch (err) {
        console.error('[AdminAppDriverDetail] load failed:', err);
        toast.error('Could not load this driver');
      } finally {
        setLoading(false);
      }
    })();
  }, [driverId]);

  const status = getVehicleStatus(location?.speed ?? 0, location?.updated_at ?? driver?.last_seen_at);
  const name = driver?.driver_name?.trim() || 'Unnamed driver';

  const openDirections = () => {
    if (!location) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${location.latitude},${location.longitude}&travelmode=driving`,
      '_system'
    );
  };

  const copyCode = async () => {
    if (!driver?.admin_code) return;
    try {
      await navigator.clipboard.writeText(driver.admin_code);
      toast.success('Connection code copied');
    } catch {
      toast.error('Could not copy the code');
    }
  };

  const disconnect = async () => {
    if (!driverId) return;
    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'disconnected' })
        .eq('driver_id', driverId);
      if (error) throw error;
      toast.success(`${name} disconnected`);
      navigate('/app/admin/fleet', { replace: true });
    } catch (err) {
      console.error('[AdminAppDriverDetail] disconnect failed:', err);
      toast.error('Could not disconnect this driver');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-heading text-base font-semibold">Driver not found</p>
        <Button variant="outline" onClick={() => navigate('/app/admin/fleet')}>
          Back to fleet
        </Button>
      </div>
    );
  }

  const classes = STATUS_CLASSES[status];

  return (
    <div className="h-full overflow-y-auto">
      {/* Identity header */}
      <div className="border-b border-border bg-card px-4 py-4">
        <button
          type="button"
          onClick={() => navigate('/app/admin/fleet')}
          className="mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Fleet
        </button>

        <div className="flex items-center gap-3">
          <span
            className="h-11 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: getDriverAccent(driver.driver_id) }}
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-heading text-xl font-bold text-foreground">{name}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  classes.chip
                )}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', classes.dot)} />
                {STATUS_LABEL[status]}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatLastSeen(location?.updated_at ?? driver.last_seen_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            className="h-11 flex-1 gap-1.5 text-xs"
            onClick={() => navigate(`/app/admin/jobs/new?driver=${driver.driver_id}`)}
          >
            <Plus className="h-4 w-4" />
            Assign job
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 gap-1.5 text-xs"
            onClick={() => navigate(`/app/admin/drivers/${driver.driver_id}/history`)}
          >
            <History className="h-4 w-4" />
            History
          </Button>
        </div>
      </div>

      <div className="space-y-7 px-4 py-5">
        {/* Live readings */}
        {location && (
          <section>
            <p className="eyebrow mb-3">Right now</p>
            {/* Battery is deliberately absent: it is only held in the driver
                app's local state and never written to driver_locations, so
                there is nothing truthful to show here. */}
            <div className="grid grid-cols-2 gap-3">
              <Stat
                icon={Gauge}
                label="Speed"
                value={Math.round(location.speed ?? 0).toString()}
                unit="km/h"
              />
              <Stat
                icon={MapPin}
                label="GPS accuracy"
                value={location.accuracy ? `±${Math.round(location.accuracy)}` : '—'}
                unit={location.accuracy ? 'm' : undefined}
              />
            </div>
          </section>
        )}

        {/* Driving stats */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">Driving</p>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRange(r.id)}
                  className={cn(
                    'min-h-[32px] rounded-md px-2 text-[11px] font-semibold transition-colors',
                    range === r.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {insightsLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Stat
                icon={RouteIcon}
                label="Distance"
                value={(insights?.distance_km ?? 0).toFixed(1)}
                unit="km"
              />
              <Stat
                icon={Gauge}
                label="Avg speed"
                value={Math.round(insights?.avg_speed_kmh ?? 0).toString()}
                unit="km/h"
              />
              <Stat
                icon={TrendingUp}
                label="Top speed"
                value={Math.round(insights?.max_speed_kmh ?? 0).toString()}
                unit="km/h"
              />
              <Stat
                icon={Timer}
                label="Idle"
                value={Math.round(insights?.idle_minutes ?? 0).toString()}
                unit="min"
              />
            </div>
          )}
        </section>

        {/* Tracking coverage — makes silence visible */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="eyebrow">Tracking coverage · 24 h</p>
            <p className="telemetry text-xs font-semibold">
              {coveragePercent(gaps, 24 * 60)}%
            </p>
          </div>

          {openGap && (
            <div className="mb-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-destructive">
                  Not reporting for {formatGapDuration(openGap.minutes)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Phone off, out of battery, or the app was force-closed.
                </p>
              </div>
            </div>
          )}

          {gaps.length === 0 && !openGap ? (
            <p className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-muted-foreground">
              Continuous — no reporting gaps in the last 24 hours.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {gaps.slice(-5).reverse().map((gap, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <SignalZero className="h-4 w-4 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      Dark for {formatGapDuration(gap.minutes)}
                    </p>
                    <p className="telemetry text-xs text-muted-foreground">
                      {format(gap.startedAt, 'HH:mm')} → {format(gap.endedAt, 'HH:mm')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Jobs */}
        <section>
          <p className="eyebrow mb-3">Recent jobs</p>
          {tasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
              No jobs assigned yet.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {tasks.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                    {task.status.replace(/_/g, ' ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Connection */}
        <section>
          <p className="eyebrow mb-3">Connection</p>
          <div
            className="overflow-hidden rounded-xl border border-border bg-card"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <button
              type="button"
              onClick={copyCode}
              className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">Code</span>
                <span className="telemetry block text-base font-bold tracking-[0.2em] text-foreground">
                  {driver.admin_code}
                </span>
              </span>
              <Copy className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            <div className="border-t border-border" />

            <button
              type="button"
              onClick={() => setDisconnectOpen(true)}
              className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-muted"
            >
              <Unlink className="h-4 w-4 shrink-0 text-destructive" />
              <span className="flex-1 text-sm font-medium text-destructive">Disconnect driver</span>
            </button>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title={`Disconnect ${name}?`}
        description="They will stop sharing their location and will need the connection code again to rejoin. Their history is kept."
        confirmLabel="Disconnect"
        destructive
        onConfirm={disconnect}
      />
    </div>
  );
}
