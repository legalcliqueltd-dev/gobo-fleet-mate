import { useMemo, useState } from 'react';
import { useDeviceLocations } from '../hooks/useDeviceLocations';
import MapView from '../components/map/MapView';
import GeofenceAlerts from '../components/GeofenceAlerts';
import TempTrackingManager from '../components/TempTrackingManager';
import { Clock, Plus, ExternalLink, TrendingUp } from 'lucide-react';
import clsx from 'clsx';
import { Link, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function Dashboard() {
  const { items, markers, loading, error } = useDeviceLocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const selected = useMemo(
    () => items.find((d) => d.id === selectedId) ?? null,
    [items, selectedId]
  );

  return (
    <div className="space-y-4">
      {/* Analytics Banner */}
      <Link
        to="/analytics"
        className="block rounded-xl border border-cyan-200 dark:border-cyan-800 bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 p-4 hover:shadow-md transition-shadow"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-cyan-600 text-white p-2">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-cyan-900 dark:text-cyan-100">Fleet Analytics</h3>
              <p className="text-sm text-cyan-700 dark:text-cyan-300">
                View aggregated metrics, status breakdown, and utilization trends
              </p>
            </div>
          </div>
          <ExternalLink className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
        </div>
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
      <Card variant="brutal">
        <CardHeader className="flex items-center justify-between">
          <h3 className="font-heading font-semibold">Your devices</h3>
          <Link to="/devices/new" className="inline-flex">
            <Button variant="outline" size="sm"><Plus className="h-3 w-3 mr-1" /> Add Device</Button>
          </Link>
        </CardHeader>
        <CardContent>
          {loading && <div className="text-sm text-slate-500">Loading devices…</div>}
          {error && <div className="text-sm text-red-600">{error}</div>}
          {!loading && items.length === 0 && (
            <div className="text-sm text-slate-500">No devices yet. Click "Add Device" to create one.</div>
          )}
          <ul className="space-y-2">
            {items.map((d) => {
              const hasFix = !!d.latest;
              return (
                <li key={d.id}>
                  <div
                    className={clsx(
                      'w-full rounded-md border px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800',
                      selectedId === d.id
                        ? 'border-cyan-400 bg-cyan-50/50 dark:bg-cyan-900/10'
                        : 'border-slate-200 dark:border-slate-800'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <button onClick={() => setSelectedId(d.id)} className="text-left flex-1">
                        <div className="flex items-center gap-2">
                          <div className={clsx(
                            'h-2.5 w-2.5 rounded-full',
                            d.status === 'active' ? 'bg-emerald-500' : d.status === 'idle' ? 'bg-amber-500' : 'bg-slate-400'
                          )} />
                          <span className="font-medium">{d.name ?? 'Unnamed device'}</span>
                        </div>
                        <div className="mt-1 text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {hasFix ? new Date(d.latest!.timestamp).toLocaleString() : '—'}
                        </div>
                      </button>
                      <Link to={`/devices/${d.id}`} className="text-xs inline-flex items-center gap-1 hover:underline">
                        Details <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 text-xs text-slate-500">Click a device to recenter the map. Open details to view history.</div>
        </CardContent>
      </Card>

      <section>
        <MapView
          items={markers}
          onMarkerClick={(id) => {
            setSelectedId(id);
            navigate(`/devices/${id}`);
          }}
        />
        {/* Floating brutal FAB for small screens */}
        <Link to="/devices/new" className="md:hidden fixed bottom-6 right-6 z-20 safe-bottom">
          <Button variant="brutal" size="icon" className="rounded-xl h-14 w-14">
            <Plus className="h-6 w-6" />
          </Button>
        </Link>
        <div className="mt-2 text-xs text-slate-500">Toggle map style (Streets/Satellite) in the map controls.</div>
      </section>
    </div>

    {/* Temporary Tracking Section */}
    <div className="mt-6">
      <TempTrackingManager />
    </div>
    
    <GeofenceAlerts />
    </div>
  );
}
