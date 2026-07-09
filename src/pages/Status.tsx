import HealthCheck from '@/components/HealthCheck';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';

export default function Status() {
  // Check the key the app actually uses (env var or built-in fallback),
  // not just the env var — otherwise this reports "missing" while the map works.
  const hasGoogleMaps = !!GOOGLE_MAPS_API_KEY;
  const usingEnvKey = !!import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  return (
    <div className="space-y-4">
      <h2 className="font-heading text-2xl font-semibold">Status</h2>
      <div className="flex items-center gap-2">
        <HealthCheck />
        <span className="text-sm text-muted-foreground">Supabase</span>
      </div>
      <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 backdrop-blur">
        <div className={`h-3 w-3 rounded-full ${hasGoogleMaps ? 'bg-success' : 'bg-warning'}`} />
        <span className="text-sm">
          Google Maps key {hasGoogleMaps ? `configured (${usingEnvKey ? 'from environment' : 'built-in'})` : 'missing'}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        If any indicator is yellow, verify environment variables and rebuild.
      </p>
    </div>
  );
}
