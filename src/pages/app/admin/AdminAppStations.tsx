import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Circle, Marker, useJsApiLoader } from '@react-google-maps/api';
import { ChevronDown, ChevronUp, Layers, Loader2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { Button } from '@/components/ui/button';
import ScreenHeader from '@/components/ScreenHeader';
import StationEditorSheet from '@/components/admin/StationEditorSheet';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getNavMapStyle } from '@/lib/mapStyles';
import { fetchStations, kindMeta, type Station } from '@/integrations/supabase/stations';
import { useStationMapPreference } from '@/hooks/useStationMapPreference';
import { useStationProgress, STATE_COLOR } from '@/hooks/useStationProgress';
import { stationMarkerIcon } from '@/lib/stationMarker';
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
  const [mapType, setMapType] = useState<'hybrid' | 'roadmap'>('hybrid');
  const { enabled: showOnFleetMap, toggle: setShowOnFleetMap } = useStationMapPreference();
  // Today's round across the whole fleet — the number this screen answers.
  const { summary: round } = useStationProgress(null);
  // Folded away until wanted: the map is for placing stations, which is a
  // setup job, not something you do every time you open the tab.
  const [mapOpen, setMapOpen] = useState(false);

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

  const left = Math.max(round.total - round.done, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto pb-4">
        <ScreenHeader
          eyebrow="Today's round"
          title="Stations"
          count={loading || round.total === 0 ? null : left}
          countLabel="left today"
          done={round.done}
          total={round.total}
        >
          <button
            type="button"
            onClick={() => setMapOpen((open) => !open)}
            aria-expanded={mapOpen}
            className="flex min-h-[36px] items-center gap-1.5 rounded-full bg-brand-ink-foreground/10 px-3.5 text-xs font-semibold text-brand-ink-foreground/80"
          >
            {mapOpen ? 'Hide map' : 'Show map'}
            {mapOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </ScreenHeader>

        {mapOpen && (
          <div className="relative mx-3 mt-3 h-64 overflow-hidden rounded-2xl border border-border">
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={stations.length ? 13 : 11}
                options={{
                  disableDefaultUI: true,
                  gestureHandling: 'greedy',
                  clickableIcons: false,
                  mapTypeId: mapType,
                  styles: mapType === 'roadmap' ? getNavMapStyle(isDark) : undefined,
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
                        strokeColor: STATE_COLOR.pending,
                        strokeOpacity: 0.5,
                        strokeWeight: 1.5,
                        fillColor: STATE_COLOR.pending,
                        fillOpacity: 0.08,
                        clickable: false,
                      }}
                    />
                    {(() => {
                      const icon = stationMarkerIcon(s.kind, STATE_COLOR.pending, 'full');
                      return (
                        <Marker
                          position={{ lat: s.latitude, lng: s.longitude }}
                          onClick={() => navigate(`/app/admin/stations/${s.id}`)}
                          zIndex={2}
                          icon={{
                            url: icon.url,
                            scaledSize: new google.maps.Size(icon.width, icon.height),
                            anchor: new google.maps.Point(icon.anchorX, icon.anchorY),
                            labelOrigin: new google.maps.Point(icon.width / 2, icon.labelY),
                          }}
                          label={{
                            text: s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name,
                            color: isDark ? '#dbe2ea' : '#1f2937',
                            fontSize: '11px',
                            fontWeight: '600',
                          }}
                        />
                      );
                    })()}
                  </div>
                ))}
              </GoogleMap>
            ) : (
              <div className="flex h-full items-center justify-center bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            <button
              type="button"
              onClick={() => setMapType((t) => (t === 'hybrid' ? 'roadmap' : 'hybrid'))}
              className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/95 shadow-lg backdrop-blur"
              aria-label={mapType === 'hybrid' ? 'Switch to map view' : 'Switch to satellite view'}
            >
              <Layers className="h-4 w-4" />
            </button>

            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center">
              <span className="rounded-full bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground backdrop-blur">
                Tap the map to add a station
              </span>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading stations…
          </div>
        )}

        {!loading && stations.length === 0 && (
          <p className="px-8 py-12 text-center text-sm text-muted-foreground">
            No stations yet. Add the places a driver must visit — a depot, a dump site, a gate.
          </p>
        )}

        {/* Same row as the More sheet: tile, name, one line. */}
        <ul className="mt-3 px-3">
          {stations.map((s) => {
            const meta = kindMeta(s.kind);
            const note = [
              !s.active ? 'Paused' : null,
              recurrenceLabel(s),
              `${s.radius_m} m`,
              s.requires_photo ? 'receipt' : null,
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/admin/stations/${s.id}`)}
                  className={cn(
                    'flex min-h-[56px] w-full items-center gap-3.5 rounded-xl px-2.5 py-2 text-left transition-colors active:bg-muted',
                    !s.active && 'opacity-60'
                  )}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-lg">
                    {meta.emoji}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{note}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* A preference, so it sits quietly under the list it applies to. */}
        {stations.length > 0 && (
          <button
            type="button"
            onClick={() => setShowOnFleetMap(!showOnFleetMap)}
            className="mx-3 mt-3 flex min-h-[48px] w-[calc(100%-1.5rem)] items-center gap-3 rounded-xl px-2.5 text-left"
          >
            <span className="min-w-0 flex-1 text-sm text-muted-foreground">Show on the fleet map</span>
            <span
              className={cn(
                'relative h-6 w-11 shrink-0 rounded-full transition-colors',
                showOnFleetMap ? 'bg-primary' : 'bg-input'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  showOnFleetMap ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                )}
              />
            </span>
          </button>
        )}
      </div>

      <div
        className="border-t border-border bg-background px-4 py-3"
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
