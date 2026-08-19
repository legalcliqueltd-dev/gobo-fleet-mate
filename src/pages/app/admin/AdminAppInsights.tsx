import { useState } from 'react';
import { Activity, Gauge, Loader2, Route as RouteIcon, Timer, TrendingUp } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useFleetAnalytics } from '@/hooks/useFleetAnalytics';
import { cn } from '@/lib/utils';

const RANGES = [
  { days: 1, label: '24 h' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

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
      className="rounded-xl border border-border bg-card p-3.5"
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
 * Fleet performance at a glance.
 *
 * Figures come from the same noise-hardened `driver_fleet_stats` RPC the web
 * dashboard uses, so a stationary vehicle reads as zero distance here too
 * rather than accumulating GPS jitter.
 */
export default function AdminAppInsights() {
  const [days, setDays] = useState(7);
  const { stats, utilization, loading, error } = useFleetAnalytics(days);

  const chartData = utilization.map((day) => ({
    day: new Date(day.day).toLocaleDateString(undefined, { weekday: 'short' }),
    percent: Math.round(day.utilization_percent),
  }));

  return (
    <div className="h-full overflow-y-auto px-3 py-3">
      {/* Range picker */}
      <div className="mb-3 flex gap-1.5">
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

      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <StatTile
              icon={RouteIcon}
              label="Distance"
              value={stats.total_distance_km.toFixed(1)}
              unit="km"
            />
            <StatTile
              icon={Gauge}
              label="Avg speed"
              value={Math.round(stats.avg_speed_kmh).toString()}
              unit="km/h"
            />
            <StatTile
              icon={TrendingUp}
              label="Top speed"
              value={Math.round(stats.max_speed_kmh).toString()}
              unit="km/h"
            />
            <StatTile
              icon={Timer}
              label="Idle time"
              value={
                stats.total_idle_minutes >= 60
                  ? (stats.total_idle_minutes / 60).toFixed(1)
                  : Math.round(stats.total_idle_minutes).toString()
              }
              unit={stats.total_idle_minutes >= 60 ? 'h' : 'min'}
            />
          </div>

          {/* Live fleet composition */}
          <div
            className="mt-3 rounded-xl border border-border bg-card p-3.5"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <div className="mb-3 flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" />
              <p className="text-[11px] font-medium uppercase tracking-wider">Right now</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Moving', value: stats.active_count, tone: 'text-success' },
                { label: 'Parked', value: stats.idle_count, tone: 'text-warning' },
                { label: 'Offline', value: stats.offline_count, tone: 'text-muted-foreground' },
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

          {chartData.length > 0 && (
            <div
              className="mt-3 rounded-xl border border-border bg-card p-3.5"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Daily utilisation
              </p>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      axisLine={false}
                      tickLine={false}
                      unit="%"
                    />
                    <Tooltip
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{
                        background: 'hsl(var(--popover))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'hsl(var(--popover-foreground))',
                      }}
                      formatter={(value: number) => [`${value}%`, 'Utilisation']}
                    />
                    <Bar dataKey="percent" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <p className="px-1 py-4 text-center text-xs leading-relaxed text-muted-foreground">
            Covering {stats.driver_count} driver{stats.driver_count === 1 ? '' : 's'} over the last{' '}
            {days === 1 ? '24 hours' : `${days} days`}.
          </p>
        </>
      )}
    </div>
  );
}
