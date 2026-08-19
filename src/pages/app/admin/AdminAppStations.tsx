import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Circle, Marker, useJsApiLoader } from '@react-google-maps/api';
import { ChevronRight, Loader2, MapPin, Plus, Repeat } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { Button } from '@/components/ui/button';
import StationEditorSheet from '@/components/admin/StationEditorSheet';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getNavMapStyle } from '@/lib/mapStyles';
import { fetchStations, kindMeta, type Station } from '@/integrations/supabase/stations';
import { cn } from '@/lib/utils';

const FALLBACK_CENTER = { lat: 6.5244, lng: 3.3792 };

function recurrenceLabel(station: Station): string {
  switch (station.recurrence) {
    case 'daily':
      return 'Every day';
    case 'weekly': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = (station.recurrence_days ?? []).map((d) => names[d]).filter(Boolean);
      return days.length ? days.join(', ') : 'Weekly';
    }
    case 'once':
      return 'One time';
    default:
      return 'No schedule';
  }
}

/**
 * Stations — the points a driver must physically attend.
 *
 * Tap the map to place one; tap a row to open its receipt history. The map
 * deliberately shows only the station rings and no vehicles: mixing live
 * traffic into the setup screen is what makes these maps feel cluttered.
 */
export default function AdminAppStations() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { codes, loading: codesLoading } = useAdminCodes();
  const navigate = useNavigate();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Station> | null>(null);

  const load = useCallback(async () => {
    if (codes.length === 0) {
      setStations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setStations(await fetchStations(codes));
    } catch (err) {
      console.error('[AdminAppStations] load failed:', err);
      toast.error('Could not load stations. Has the database migration been run?');
    } finally {
      setLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  const startNewAt = (lat: number, lng: number) => {
    if (codes.length === 0) {
      toast.error('Connect a driver first — stations belong to a fleet code.');
      return;
    }
    setEditing({
      admin_user_id: user?.id,
      admin_code: codes[0],
      name: '',
      kind: 'checkpoint',
      color: '#2563eb',
      latitude: lat,
      longitude: lng,
      radius_m: 75,
      min_dwell_seconds: 60,
      requires_photo: true,
      recurrence: 'daily',
      recurrence_days: [],
      active: true,
    });
  };

  const mapCenter = stations.length
    ? { lat: stations[0].latitude, lng: stations[0].longitude }
    : FALLBACK_CENTER;

  return (
    <div className="flex h-full flex-col">
      {/* Placement map */}
      <div className="relative h-56 shrink-0 border-b border-border">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={mapCenter}
            zoom={stations.length ? 13 : 11}
            options={{
              disableDefaultUI: true,
              gestureHandling: 'greedy',
              clickableIcons: false,
              styles: getNavMapStyle(isDark),
            }}
            onClick={(e) => {
              if (e.latLng) startNewAt(e.latLng.lat(), e.latLng.lng());
            }}
          >
            {stations.map((s) => (
              <div key={s.id}>
                <Circle
                  center={{ lat: s.latitude, lng: s.longitude }}
                  radius={s.radius_m}
                  options={{
                    strokeColor: s.color,
                    strokeOpacity: 0.7,
                    strokeWeight: 1.5,
                    fillColor: s.color,
                    fillOpacity: 0.12,
                    clickable: false,
                  }}
                />
                <Marker
                  position={{ lat: s.latitude, lng: s.longitude }}
                  onClick={() => navigate(`/app/admin/stations/${s.id}`)}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: s.color,
                    fillOpacity: 1,
                    strokeColor: '#ffffff',
                    strokeWeight: 2,
                  }}
                />
              </div>
            ))}
          </GoogleMap>
        ) : (
          <div className="flex h-full items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
          <span className="rounded-full bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
            Tap the map to add a station
          </span>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading stations…
          </div>
        )}

        {!loading && stations.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <MapPin className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="font-heading text-base font-semibold">No stations yet</p>
            <p className="max-w-[17rem] text-sm text-muted-foreground">
              Mark the places a driver must pass through — a dump site, a depot, a school gate.
              They'll appear on the driver's map, and every visit is recorded.
            </p>
          </div>
        )}

        <ul className="space-y-1.5">
          {stations.map((s) => {
            const meta = kindMeta(s.kind);
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/admin/stations/${s.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left transition-colors hover:bg-muted"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                    style={{ backgroundColor: `${s.color}1f` }}
                  >
                    {meta.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{s.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Repeat className="h-3 w-3" />
                      {recurrenceLabel(s)}
                      <span className="telemetry">· {s.radius_m} m</span>
                      {s.requires_photo && <span>· receipt</span>}
                    </p>
                  </div>
                  {!s.active && (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      Paused
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        className="border-t border-border bg-background px-3 py-2.5"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <Button
          className="h-12 w-full gap-2"
          onClick={() => startNewAt(mapCenter.lat, mapCenter.lng)}
        >
          <Plus className="h-4 w-4" />
          New station
        </Button>
      </div>

      {editing && (
        <StationEditorSheet
          station={editing}
          adminCodes={codes}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
