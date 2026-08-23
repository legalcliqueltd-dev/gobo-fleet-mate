import { useCallback, useEffect, useMemo, useState } from 'react';
import { GoogleMap, Circle, Marker, useJsApiLoader } from '@react-google-maps/api';
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Loader2, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import StationEditorSheet from '@/components/admin/StationEditorSheet';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getNavMapStyle } from '@/lib/mapStyles';
import {
  deleteStation,
  fetchStationVisits,
  fetchStations,
  kindMeta,
  type Station,
  type StationVisit,
} from '@/integrations/supabase/stations';
import { useEntitlements } from '@/hooks/useEntitlements';
import StationsUpsell from '@/components/admin/StationsUpsell';
import PaymentWall from '@/components/PaymentWall';
import { cn } from '@/lib/utils';

const FALLBACK_CENTER = { lat: 6.5244, lng: 3.3792 };

function lastDays(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

function recurrenceLabel(station: Station): string {
  if (station.recurrence === 'daily') return 'Every day';
  if (station.recurrence === 'once') return 'One time';
  if (station.recurrence === 'none') return 'No schedule';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const days = (station.recurrence_days ?? []).map((d) => names[d]).filter(Boolean);
  return days.length ? days.join(', ') : 'Weekly';
}

/**
 * Stations on the web dashboard.
 *
 * Same data and the same editor as the mobile portal — this page just uses the
 * extra room: the list, the map and the selected station's receipt trail sit
 * side by side instead of being separate screens, so a manager reviewing a
 * week of attendance never loses the map context.
 */
export default function Stations() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { codes, loading: codesLoading } = useAdminCodes();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [stations, setStations] = useState<Station[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Station> | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [preview, setPreview] = useState<StationVisit | null>(null);
  const { hasAccess, canUseStations, loading: entitlementsLoading } = useEntitlements();
  const [showPlans, setShowPlans] = useState(false);

  const selected = stations.find((s) => s.id === selectedId) ?? null;

  const load = useCallback(async () => {
    if (codes.length === 0) {
      setStations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchStations(codes);
      setStations(rows);
      setSelectedId((current) => current ?? rows[0]?.id ?? null);
    } catch (err) {
      console.error('[Stations] load failed:', err);
      toast.error('Could not load stations');
    } finally {
      setLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  // Visits for whichever station is selected.
  useEffect(() => {
    if (!selectedId) {
      setVisits([]);
      return;
    }
    void (async () => {
      try {
        const rows = await fetchStationVisits(selectedId);
        setVisits(rows);
        const ids = [...new Set(rows.map((v) => v.driver_id))];
        if (ids.length) {
          const { data } = await supabase
            .from('drivers')
            .select('driver_id, driver_name')
            .in('driver_id', ids);
          setDriverNames(
            Object.fromEntries((data ?? []).map((d) => [d.driver_id, d.driver_name ?? 'Driver']))
          );
        }
      } catch (err) {
        console.error('[Stations] visits failed:', err);
      }
    })();
  }, [selectedId]);

  const days = useMemo(() => lastDays(14), []);
  const visitsByDate = useMemo(() => {
    const map: Record<string, StationVisit[]> = {};
    visits.forEach((v) => {
      (map[v.visit_date] ??= []).push(v);
    });
    return map;
  }, [visits]);

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

  const remove = async () => {
    if (!selected) return;
    try {
      await deleteStation(selected.id);
      toast.success('Station deleted');
      setSelectedId(null);
      void load();
    } catch (err) {
      console.error('[Stations] delete failed:', err);
      toast.error('Could not delete the station');
    }
  };

  const mapCenter = selected
    ? { lat: selected.latitude, lng: selected.longitude }
    : stations[0]
      ? { lat: stations[0].latitude, lng: stations[0].longitude }
      : FALLBACK_CENTER;

  // Stations are the premium feature; Basic accounts get the explainer with a
  // real call to action, which the app is not allowed to show.
  if (!entitlementsLoading && hasAccess && !canUseStations) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        {showPlans && <PaymentWall onDismiss={() => setShowPlans(false)} />}
        <StationsUpsell onUpgrade={() => setShowPlans(true)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Fleet</p>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Stations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Points a driver must attend. Every arrival is recorded; a photo receipt proves it.
          </p>
        </div>
        <Button className="gap-2" onClick={() => startNewAt(mapCenter.lat, mapCenter.lng)}>
          <Plus className="h-4 w-4" />
          New station
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        {/* List */}
        <div className="order-2 lg:order-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : stations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <MapPin className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="font-heading font-semibold">No stations yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Click anywhere on the map to mark your first one.
              </p>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {stations.map((s) => {
                const meta = kindMeta(s.kind);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors',
                        selectedId === s.id
                          ? 'border-primary bg-accent'
                          : 'border-border bg-card hover:bg-muted'
                      )}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg"
                        style={{ backgroundColor: `${s.color}1f` }}
                      >
                        {meta.emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{s.name}</span>
                        <span className="telemetry block text-xs text-muted-foreground">
                          {recurrenceLabel(s)} · {s.radius_m} m
                        </span>
                      </span>
                      {!s.active && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                          Paused
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Map + detail */}
        <div className="order-1 space-y-4 lg:order-2">
          <div className="overflow-hidden rounded-xl border border-border" style={{ height: 380 }}>
            {isLoaded ? (
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={mapCenter}
                zoom={selected ? 15 : 12}
                options={{
                  disableDefaultUI: true,
                  zoomControl: true,
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
                        strokeOpacity: selectedId === s.id ? 0.9 : 0.45,
                        strokeWeight: selectedId === s.id ? 2 : 1.5,
                        fillColor: s.color,
                        fillOpacity: selectedId === s.id ? 0.18 : 0.08,
                        clickable: false,
                      }}
                    />
                    <Marker
                      position={{ lat: s.latitude, lng: s.longitude }}
                      onClick={() => setSelectedId(s.id)}
                      icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: selectedId === s.id ? 9 : 7,
                        fillColor: s.color,
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                        labelOrigin: new google.maps.Point(0, 3.4),
                      }}
                      label={{
                        text: s.name.length > 18 ? `${s.name.slice(0, 17)}…` : s.name,
                        color: isDark ? '#dbe2ea' : '#1f2937',
                        fontSize: '11px',
                        fontWeight: '600',
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
          </div>

          {selected && (
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-lg font-bold">{selected.name}</h2>
                  <p className="telemetry text-xs text-muted-foreground">
                    {selected.radius_m} m · {selected.min_dwell_seconds}s ·{' '}
                    {selected.requires_photo ? 'receipt required' : 'no receipt'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditing(selected)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>

              {/* Attendance strip */}
              <p className="eyebrow mb-2">Last 14 days</p>
              <div className="flex gap-1">
                {days.map((day) => {
                  const dayVisits = visitsByDate[day] ?? [];
                  const hasReceipt = dayVisits.some((v) => v.status === 'completed');
                  const attended = dayVisits.length > 0;
                  return (
                    <div
                      key={day}
                      title={`${day}: ${hasReceipt ? 'receipt' : attended ? 'arrived, no receipt' : 'missed'}`}
                      className={cn(
                        'h-9 flex-1 rounded-md',
                        hasReceipt ? 'bg-success' : attended ? 'bg-warning' : 'bg-muted'
                      )}
                    />
                  );
                })}
              </div>
              <div className="mt-1.5 flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-success" /> receipt
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-warning" /> arrived only
                </span>
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm bg-muted" /> missed
                </span>
              </div>

              {/* Visit log */}
              <p className="eyebrow mb-2 mt-5">Visit log</p>
              {visits.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-5 text-center text-sm text-muted-foreground">
                  No visits recorded yet.
                </p>
              ) : (
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {visits.map((v) => (
                    <li
                      key={v.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5"
                    >
                      {v.photo_url ? (
                        <button type="button" onClick={() => setPreview(v)} className="shrink-0">
                          <img
                            src={v.photo_url}
                            alt="Receipt"
                            className="h-12 w-12 rounded-md object-cover"
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-warning/10">
                          <CameraOff className="h-4 w-4 text-warning" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {driverNames[v.driver_id] ?? v.driver_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(v.arrived_at), 'd MMM, HH:mm')} ·{' '}
                          {formatDistanceToNow(new Date(v.arrived_at), { addSuffix: true })}
                        </p>
                        {v.flag_reason && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-warning">
                            <AlertTriangle className="h-3 w-3" />
                            {v.flag_reason}
                          </p>
                        )}
                      </div>
                      {v.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                      ) : (
                        <Camera className="h-4 w-4 shrink-0 text-warning" />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>

      {preview?.photo_url && (
        <button
          type="button"
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black/90 p-6"
        >
          <img src={preview.photo_url} alt="Receipt" className="max-h-[75vh] w-auto rounded-lg" />
          <p className="telemetry mt-3 text-xs text-white/80">
            {preview.photo_submitted_at &&
              format(new Date(preview.photo_submitted_at), 'd MMM yyyy, HH:mm')}
            {preview.photo_distance_m != null &&
              ` · ${Math.round(preview.photo_distance_m)} m from the station`}
          </p>
        </button>
      )}

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

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${selected?.name ?? 'station'}?`}
        description="The station and its entire visit history, including the photo receipts, are permanently deleted. This cannot be undone."
        confirmLabel="Delete station"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
