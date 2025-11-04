import { useState } from 'react';
import { useFleetAnalytics } from '../hooks/useFleetAnalytics';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Gauge, Route as RouteIcon, Timer, TrendingUp, Activity } from 'lucide-react';

const STATUS_COLORS = {
  active: '#10b981',
  idle: '#f59e0b',
  offline: '#94a3b8',
};

export default function FleetAnalytics() {
  const [range, setRange] = useState<7 | 30>(7);
  const { stats, utilization, loading, error } = useFleetAnalytics(range);

  const statusData = stats
    ? [
        { name: 'Active', value: stats.active_count, color: STATUS_COLORS.active },
        { name: 'Idle', value: stats.idle_count, color: STATUS_COLORS.idle },
        { name: 'Offline', value: stats.offline_count, color: STATUS_COLORS.offline },
      ]
    : [];

  const utilizationData = utilization.map((day) => ({
    date: new Date(day.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    utilization: Number(day.utilization_percent),
    activeHours: (day.total_active_minutes / 60).toFixed(1),
  }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 p-4">
        <p className="text-red-600 dark:text-red-400">Error loading analytics: {error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Fleet Analytics</h1>
        <div className="inline-flex items-center gap-2">
          <button
            onClick={() => setRange(7)}
            className={`text-sm rounded-md border px-3 py-1.5 ${
              range === 7
                ? 'bg-cyan-600 text-white border-cyan-600'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Last 7 days
          </button>
          <button
            onClick={() => setRange(30)}
            className={`text-sm rounded-md border px-3 py-1.5 ${
              range === 30
                ? 'bg-cyan-600 text-white border-cyan-600'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Last 30 days
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-cyan-100 dark:bg-cyan-900/30 p-2">
              <Activity className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Total Devices</span>
          </div>
          <div className="text-3xl font-bold">{stats?.device_count ?? 0}</div>
          <div className="mt-2 text-xs text-slate-500">
            {stats?.active_count ?? 0} active • {stats?.idle_count ?? 0} idle • {stats?.offline_count ?? 0} offline
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-2">
              <RouteIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Total Distance</span>
          </div>
          <div className="text-3xl font-bold">{(stats?.total_distance_km ?? 0).toFixed(0)} km</div>
          <div className="mt-2 text-xs text-slate-500">Across all devices</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2">
              <Gauge className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Avg Speed</span>
          </div>
          <div className="text-3xl font-bold">{Math.round(stats?.avg_speed_kmh ?? 0)} km/h</div>
          <div className="mt-2 text-xs text-slate-500">Max: {Math.round(stats?.max_speed_kmh ?? 0)} km/h</div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2">
              <Timer className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Idle Time</span>
          </div>
          <div className="text-3xl font-bold">{Math.round((stats?.total_idle_minutes ?? 0) / 60)} hrs</div>
          <div className="mt-2 text-xs text-slate-500">{stats?.total_idle_minutes ?? 0} minutes total</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown Pie Chart */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Device Status Breakdown</h3>
          </div>
          {statusData.some((d) => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              No devices to display
            </div>
          )}
        </div>

        {/* Fleet Utilization Chart */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5" />
            <h3 className="text-lg font-semibold">Fleet Utilization</h3>
          </div>
          {utilizationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={utilizationData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-lg border bg-white dark:bg-slate-900 p-3 shadow-lg">
                          <p className="font-semibold">{payload[0].payload.date}</p>
                          <p className="text-sm text-cyan-600">
                            Utilization: {payload[0].value}%
                          </p>
                          <p className="text-sm text-slate-600">
                            Active: {payload[0].payload.activeHours}h
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="utilization" fill="#06b6d4" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              No utilization data available
            </div>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/60 dark:bg-blue-900/20 backdrop-blur p-4">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">About Fleet Utilization</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Utilization percentage represents the ratio of active time (speed ≥ 1 km/h) to total potential time
              across all devices. Higher utilization indicates more efficient fleet usage.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
