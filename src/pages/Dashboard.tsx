import { useMemo, useState } from 'react';
import { useDeviceLocations } from '../hooks/useDeviceLocations';
import MapView from '../components/map/MapView';
import { Clock, Plus, ExternalLink } from 'lucide-react';
import clsx from 'clsx';
import { Link, useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const { items, markers, loading, error } = useDeviceLocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const selected = useMemo(
    () => items.find((d) => d.id === selectedId) ?? null,
    [items, selectedId]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
      <aside className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Your devices</h3>
          <Link to="/devices/new" className="inline-flex items-center gap-1 text-xs rounded-md border px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Plus className="h-3 w-3" /> Add Device
          </Link>
        </div>

        {loading && <div className="text-sm text-slate-500">Loading devices…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {!loading && items.length === 0 && (
          <div className="text-sm text-slate-500">
            No devices yet. Click "Add Device" to create one.
          </div>
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
                    <button
                      onClick={() => setSelectedId(d.id)}
                      className="text-left flex-1"
                    >
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

        <div className="mt-4 text-xs text-slate-500">
          Click a device to recenter the map. Open details to view history.
        </div>
      </aside>

      <section>
        <MapView
          items={markers}
          onMarkerClick={(id) => {
            setSelectedId(id);
            navigate(`/devices/${id}`);
          }}
        />
        <div className="mt-2 text-xs text-slate-500">
          Toggle map style (Streets/Satellite) in the map's top-left controls.
        </div>
      </section>
    </div>
  );
}
