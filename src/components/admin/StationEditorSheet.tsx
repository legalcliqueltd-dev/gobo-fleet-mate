import { useState } from 'react';
import { Circle, GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { Layers, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getNavMapStyle } from '@/lib/mapStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import FormError from '@/components/admin/FormError';
import {
  createStation,
  updateStation,
  STATION_KINDS,
  type Recurrence,
  type Station,
} from '@/integrations/supabase/stations';
import { cn } from '@/lib/utils';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const RECURRENCES: { id: Recurrence; label: string; hint: string }[] = [
  { id: 'daily', label: 'Every day', hint: 'Expected once each day' },
  { id: 'weekly', label: 'Certain days', hint: 'Pick the weekdays below' },
  { id: 'once', label: 'One time', hint: 'A single visit' },
  { id: 'none', label: 'No schedule', hint: 'Visitable, never chased' },
];

/**
 * Create / edit a station.
 *
 * The radius and dwell defaults (75 m, 60 s) are the ones that make arrival
 * detection trustworthy: tighter radii miss real visits because phone GPS
 * drifts, and the dwell requirement is what separates attending from driving
 * past on the road outside.
 */
export default function StationEditorSheet({
  station,
  adminCodes,
  onClose,
  onSaved,
}: {
  station: Partial<Station>;
  adminCodes: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !station.id;
  const { isDark } = useTheme();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [name, setName] = useState(station.name ?? '');
  const [kind, setKind] = useState(station.kind ?? 'checkpoint');
  const [notes, setNotes] = useState(station.notes ?? '');
  const [radius, setRadius] = useState(station.radius_m ?? 75);
  const [dwell, setDwell] = useState(station.min_dwell_seconds ?? 60);
  const [requiresPhoto, setRequiresPhoto] = useState(station.requires_photo ?? true);
  const [recurrence, setRecurrence] = useState<Recurrence>(station.recurrence ?? 'daily');
  const [days, setDays] = useState<number[]>(station.recurrence_days ?? []);
  const [adminCode, setAdminCode] = useState(station.admin_code ?? adminCodes[0] ?? '');
  const [address, setAddress] = useState('');
  // Satellite by default: a station is a physical place — a gate, a skip, a
  // yard corner — and imagery identifies it far faster than a road map, which
  // shows only an empty street. Labels stay on ('hybrid') so the surrounding
  // road names remain readable.
  const [mapType, setMapType] = useState<'hybrid' | 'roadmap'>('hybrid');
  const [coords, setCoords] = useState({
    lat: station.latitude ?? 6.5244,
    lng: station.longitude ?? 3.3792,
  });
  const [active, setActive] = useState(station.active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleDay = (day: number) =>
    setDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));

  const save = async () => {
    setError('');
    if (!name.trim()) return setError('Give the station a name the driver will recognise.');
    if (recurrence === 'weekly' && days.length === 0)
      return setError('Pick at least one weekday.');

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        kind,
        notes: notes.trim() || null,
        radius_m: radius,
        min_dwell_seconds: dwell,
        requires_photo: requiresPhoto,
        recurrence,
        recurrence_days: recurrence === 'weekly' ? days : null,
        active,
        admin_code: adminCode,
      };

      if (isNew) {
        await createStation({
          ...payload,
          admin_user_id: station.admin_user_id!,
          latitude: coords.lat,
          longitude: coords.lng,
          color: station.color ?? '#2563eb',
        });
        toast.success('Station created');
      } else {
        // Editing can move the station too, so the coordinates go with it.
        await updateStation(station.id!, {
          ...payload,
          latitude: coords.lat,
          longitude: coords.lng,
        });
        toast.success('Station updated');
      }
      onSaved();
    } catch (err) {
      console.error('[StationEditorSheet] save failed:', err);
      setError(err instanceof Error ? err.message : 'Could not save the station.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background">
      <header
        className="flex items-center gap-2 border-b border-border px-3 py-2.5"
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex-1 font-heading text-lg font-semibold">
          {isNew ? 'New station' : 'Edit station'}
        </h2>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="st-name">Name</Label>
          <Input
            id="st-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ojota dump site"
            className="h-12"
          />
          <p className="text-xs text-muted-foreground">This is what the driver sees on the map.</p>
        </div>

        {/* Location: search to get close, then tap or drag to place it exactly.
            The ring is the real arrival radius, so the radius slider below is
            immediately legible against the actual site. */}
        <div className="space-y-1.5">
          <Label>Location</Label>

          {isLoaded ? (
            <AddressAutocomplete
              value={address}
              onChange={(nextAddress, lat, lng) => {
                setAddress(nextAddress);
                setCoords({ lat, lng });
                // Only ever fills a blank name — never overwrites the
                // manager's own wording.
                if (!name.trim()) setName(nextAddress.split(',')[0] ?? '');
              }}
              placeholder="Search an address or place"
            />
          ) : (
            <div className="flex h-12 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading address search…
            </div>
          )}

          {isLoaded && (
            <div className="relative overflow-hidden rounded-xl border border-border">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: 320 }}
                center={coords}
                zoom={18}
                options={{
                  disableDefaultUI: true,
                  gestureHandling: 'greedy',
                  clickableIcons: false,
                  mapTypeId: mapType,
                  // Google's own imagery styling is used as-is; the custom nav
                  // palette only applies to the road map.
                  styles: mapType === 'roadmap' ? getNavMapStyle(isDark) : undefined,
                }}
                onClick={(e) => {
                  if (e.latLng) setCoords({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                }}
              >
                <Circle
                  center={coords}
                  radius={radius}
                  options={{
                    strokeColor: '#2563eb',
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: '#2563eb',
                    fillOpacity: 0.15,
                    clickable: false,
                  }}
                />
                <Marker
                  position={coords}
                  draggable
                  onDragEnd={(e) => {
                    if (e.latLng) setCoords({ lat: e.latLng.lat(), lng: e.latLng.lng() });
                  }}
                />
              </GoogleMap>

              <button
                type="button"
                onClick={() => setMapType((t) => (t === 'hybrid' ? 'roadmap' : 'hybrid'))}
                className="absolute right-2 top-2 flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border bg-background/95 px-2.5 text-xs font-semibold shadow-lg backdrop-blur"
              >
                <Layers className="h-4 w-4" />
                {mapType === 'hybrid' ? 'Map' : 'Satellite'}
              </button>
            </div>
          )}

          <p className="telemetry text-xs text-muted-foreground">
            {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} — tap or drag the pin to refine.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Type</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {STATION_KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={cn(
                  'flex min-h-[62px] flex-col items-center justify-center gap-1 rounded-xl border text-[10px] font-medium transition-colors',
                  kind === k.id
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border bg-card text-muted-foreground'
                )}
              >
                <span className="text-lg">{k.emoji}</span>
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {/* Arrival rule */}
        <div className="space-y-3 rounded-xl border border-border bg-card p-3.5">
          <p className="eyebrow">Arrival rule</p>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="st-radius">Radius</Label>
              <span className="telemetry text-sm font-semibold">{radius} m</span>
            </div>
            <input
              id="st-radius"
              type="range"
              min={20}
              max={500}
              step={5}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              How close counts as "here". Below ~50 m, normal GPS drift starts marking real
              visits as missed.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="st-dwell">Must stay</Label>
              <span className="telemetry text-sm font-semibold">{dwell}s</span>
            </div>
            <input
              id="st-dwell"
              type="range"
              min={0}
              max={600}
              step={15}
              value={dwell}
              onChange={(e) => setDwell(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground">
              Stops a driver who merely passes on the road outside from being credited.
            </p>
          </div>
        </div>

        {/* Receipt */}
        <button
          type="button"
          onClick={() => setRequiresPhoto((v) => !v)}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Require a photo receipt</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Arrival is always recorded. With this on, the visit is only complete once the
              driver submits a live photo.
            </span>
          </span>
          <span
            className={cn(
              'relative h-6 w-11 shrink-0 rounded-full transition-colors',
              requiresPhoto ? 'bg-primary' : 'bg-input'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                requiresPhoto ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
              )}
            />
          </span>
        </button>

        {/* Schedule */}
        <div className="space-y-2">
          <Label>Schedule</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {RECURRENCES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRecurrence(r.id)}
                className={cn(
                  'rounded-xl border p-2.5 text-left transition-colors',
                  recurrence === r.id ? 'border-primary bg-accent' : 'border-border bg-card'
                )}
              >
                <span className="block text-sm font-semibold">{r.label}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{r.hint}</span>
              </button>
            ))}
          </div>

          {recurrence === 'weekly' && (
            <div className="flex gap-1.5 pt-1">
              {DAY_LABELS.map((label, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => toggleDay(index)}
                  className={cn(
                    'h-11 flex-1 rounded-lg border text-sm font-semibold transition-colors',
                    days.includes(index)
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-card text-muted-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {adminCodes.length > 1 && (
          <div className="space-y-1.5">
            <Label>Fleet code</Label>
            <div className="flex flex-wrap gap-1.5">
              {adminCodes.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setAdminCode(code)}
                  className={cn(
                    'telemetry min-h-[40px] rounded-lg border px-3 text-sm font-semibold',
                    adminCode === code ? 'border-primary bg-accent' : 'border-border bg-card'
                  )}
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="st-notes">Instructions for the driver (optional)</Label>
          <Textarea
            id="st-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Photograph the loaded skip before leaving"
            rows={2}
          />
        </div>

        {!isNew && (
          <button
            type="button"
            onClick={() => setActive((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-card p-3.5 text-left"
          >
            <span className="text-sm font-medium">{active ? 'Active' : 'Paused'}</span>
            <span
              className={cn(
                'relative h-6 w-11 rounded-full transition-colors',
                active ? 'bg-success' : 'bg-input'
              )}
            >
              <span
                className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                  active ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                )}
              />
            </span>
          </button>
        )}

        <FormError message={error} />
      </div>

      <div
        className="border-t border-border px-3 py-2.5"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <Button className="h-12 w-full font-semibold" disabled={saving} onClick={save}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : isNew ? (
            'Create station'
          ) : (
            'Save changes'
          )}
        </Button>
      </div>
    </div>
  );
}
