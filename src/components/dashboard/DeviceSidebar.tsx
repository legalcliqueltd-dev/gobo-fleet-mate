import type { Device, Location } from '../../types';

function statusFromTimestamp(ts?: string) {
  if (!ts) return 'offline' as const;
  const diffMin = (Date.now() - new Date(ts).getTime()) / 60000;
  if (diffMin <= 2) return 'active' as const;
  if (diffMin <= 10) return 'idle' as const;
  return 'offline' as const;
}

export default function DeviceSidebar({
  devices,
  latest,
  onSelect,
  selectedId,
}: {
  devices: Device[];
  latest: Record<string, Location | undefined>;
  onSelect: (id: string) => void;
  selectedId?: string | null;
}) {
  return (
    <aside className="w-full md:w-80 shrink-0 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Devices</h3>
        <button disabled className="text-xs rounded-md border px-2 py-1 opacity-60 cursor-not-allowed" title="Add Device (Phase 4)" >
          + Add Device
        </button>
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur divide-y divide-slate-200/70 dark:divide-slate-800/70 max-h-[60vh] overflow-y-auto">
        {devices.length === 0 && (
          <div className="p-4 text-sm text-slate-600 dark:text-slate-400">
            No devices yet. You'll add devices in Phase 4.
          </div>
        )}
        {devices.map((d) => {
          const loc = latest[d.id];
          const status = statusFromTimestamp(loc?.timestamp);
          const statusColor =
            status === 'active' ? 'bg-emerald-500' : status === 'idle' ? 'bg-amber-500' : 'bg-slate-400';
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={`w-full text-left p-3 hover:bg-slate-100/60 dark:hover:bg-slate-800/60 ${selectedId === d.id ? 'bg-slate-100/60 dark:bg-slate-800/60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{d.name || d.imei || 'Unnamed device'}</div>
                  <div className="text-xs text-slate-500">
                    {loc ? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)} • ${new Date(loc.timestamp).toLocaleTimeString()}` : 'No recent location'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${statusColor}`} />
                  <span className="text-xs capitalize">{status}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
