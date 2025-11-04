import HealthCheck from '../components/HealthCheck';

export default function Status() {
  const hasMapbox = !!import.meta.env.VITE_MAPBOX_TOKEN;
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Status</h2>
      <div className="flex items-center gap-2">
        <HealthCheck />
        <span className="text-sm text-slate-500">Supabase</span>
      </div>
      <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 px-3 py-2 backdrop-blur">
        <div className={`h-3 w-3 rounded-full ${hasMapbox ? 'bg-emerald-500' : 'bg-amber-500'}`} />
        <span className="text-sm">Mapbox token {hasMapbox ? 'present' : 'missing'} (VITE_MAPBOX_TOKEN)</span>
      </div>
      <p className="text-xs text-slate-500">
        If any indicator is yellow, verify environment variables and rebuild.
      </p>
    </div>
  );
}
