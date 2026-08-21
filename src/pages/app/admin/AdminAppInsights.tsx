import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ChevronRight, Gauge, Loader2, Route as RouteIcon, Timer, TrendingUp, Users } from 'lucide-react';
import { useFleetBreakdown } from '@/hooks/useFleetBreakdown';
import { STATUS_CLASSES, STATUS_LABEL } from '@/lib/driverStatus';
import { getDriverAccent } from '@/lib/driverAccent';
import { cn } from '@/lib/utils';

const RANGES = [
  { days: 1, label: '24 h' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

function formatMinutes(minutes: number): { value: string; unit: string } {
  if (minutes >= 60) return { value: (minutes / 60).toFixed(1), unit: 'h' };
  return { value: Math.round(minutes).toString(), unit: 'min' };
}

function StatTile({
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
    <div
      className="rounded-2xl border border-border bg-card p-4"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="truncate text-[11px] font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="telemetry mt-2 text-2xl font-bold leading-none text-foreground">
        {value}
        {unit && <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>}
      </p>
    </div>
  );
}

/**
 * Fleet performance, attributable to individual drivers.
 *
 * Every headline number is the sum of the per-driver rows below it, so the two
 * can never disagree — and any figure that looks wrong can be traced to the
 * driver who produced it. Tapping a row opens that driver's full record.
 */
export default function AdminAppInsights() {
  const [days, setDays] = useState(7);
  const navigate = useNavigate();
  const { drivers, totals, loading, error } = useFleetBreakdown(days);

  const idle = formatMinutes(totals?.idleMinutes ?? 0);
  const active = formatMinutes(totals?.activeMinutes ?? 0);

  return (
    <div className="h-full overflow-y-auto px-4 py-4">
      {/* Range picker */}
      <div className="mb-4 flex gap-2">
        {RANGES.map((range) => (
          <button
            key={range.days}
            type="button"
            onClick={() => setDays(range.days)}
            className={cn(
              'min-h-[38px] flex-1 rounded-lg text-xs font-semibold transition-colors',
              days === range.days
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:text-foreground'
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Crunching the numbers…
        </div>
      )}

      {error && !loading && (
        <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!loading && !error && totals && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <StatTile icon={RouteIcon} label="Distance" value={totals.distanceKm.toFixed(1)} unit="km" />
            <StatTile
              icon={Gauge}
              label="Avg speed"
              value={Math.round(totals.avgSpeedKmh).toString()}
              unit="km/h"
            />
            <StatTile
              icon={TrendingUp}
              label="Top speed"
              value={Math.round(totals.maxSpeedKmh).toString()}
              unit="km/h"
            />
            <StatTile icon={Timer} label="Idle time" value={idle.value} unit={idle.unit} />
          </div>

          {/* Live composition */}
          <div
            className="mt-5 rounded-2xl border border-border bg-card p-4"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="mb-3 flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" />
              <p className="text-[11px] font-medium uppercase tracking-wider">Right now</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Moving', value: totals.moving, tone: 'text-success' },
                { label: 'Parked', value: totals.idle, tone: 'text-warning' },
                { label: 'Offline', value: totals.offline, tone: 'text-muted-foreground' },
              ].map((item) => (
                <div key={item.label}>
                  <p className={cn('telemetry text-xl font-bold leading-none', item.tone)}>
                    {item.value}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Per-driver breakdown */}
          <div className="mt-7">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow">By driver</p>
              <p className="text-[11px] text-muted-foreground">
                <span className="telemetry font-semibold text-foreground">
                  {totals.reportingCount}
                </span>{' '}
                of {totals.driverCount} reported
              </p>
            </div>

            {drivers.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-8 text-center">
                <Users className="h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">No drivers yet</p>
                <p className="text-xs text-muted-foreground">
                  Add a driver from the Fleet tab to start collecting data.
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {drivers.map((driver) => {
                  const classes = STATUS_CLASSES[driver.status];
                  const driverActive = formatMinutes(driver.activeMinutes);
                  return (
                    <li key={driver.driverId}>
                      <button
                        type="button"
                        onClick={() => navigate(`/app/admin/drivers/${driver.driverId}`)}
                        className="flex w-full items-center gap-3.5 rounded-2xl border border-border bg-card px-4 py-3.5 text-left transition-colors hover:bg-muted"
                        style={{ boxShadow: 'var(--shadow-card)' }}
                      >
                        <span
                          className="h-9 w-1 shrink-0 rounded-full"
                          style={{ backgroundColor: getDriverAccent(driver.driverId) }}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-sm font-semibold">{driver.name}</p>
                            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', classes.dot)} />
                          </div>
                          {driver.points === 0 ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              No data in this period · {STATUS_LABEL[driver.status]}
                            </p>
                          ) : (
                            <p className="telemetry mt-0.5 text-xs text-muted-foreground">
                              {driver.distanceKm.toFixed(1)} km ·{' '}
                              {Math.round(driver.avgSpeedKmh)} km/h avg · {driverActive.value}
                              {driverActive.unit} driving
                            </p>
                          )}
                        </div>

                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="px-1 py-7 text-center text-xs leading-relaxed text-muted-foreground">
            Figures come from GPS history over the last{' '}
            {days === 1 ? '24 hours' : `${days} days`}, filtered for GPS noise. Fleet totals are
            the sum of the drivers above.
          </p>
        </>
      )}
    </div>
  );
}
