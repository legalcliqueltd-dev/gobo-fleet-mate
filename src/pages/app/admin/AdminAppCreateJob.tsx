import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, Check, Loader2, MapPin, Package, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import FormError from '@/components/admin/FormError';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getMapStyle } from '@/lib/mapStyles';
import { useTheme } from '@/contexts/ThemeContext';
import { getDriverAccent } from '@/lib/driverAccent';
import { cn } from '@/lib/utils';

const MAP_FALLBACK_CENTER = { lat: 6.5244, lng: 3.3792 }; // Lagos

type Driver = {
  driver_id: string;
  driver_name: string | null;
  admin_code: string;
  status: string | null;
};

/**
 * Assign a job from the phone.
 *
 * Writes exactly the same `tasks` row as the website's Create Task page — same
 * columns, same `assigned` status — so a job created here is indistinguishable
 * from one created on the desktop dashboard and reaches the driver the same way.
 *
 * Reworked for one-handed use: the driver is a tap-target list rather than a
 * dropdown, and only the title / driver / drop-off are required so a job can be
 * dispatched in seconds.
 */
export default function AdminAppCreateJob() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { codes, loading: codesLoading } = useAdminCodes();
  const { isDark } = useTheme();

  // Without this the Places SDK is never fetched on this screen and the
  // address field silently returns no coordinates.
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [driverId, setDriverId] = useState(searchParams.get('driver') ?? '');
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoff, setDropoff] = useState<{ lat: number; lng: number } | null>(null);
  const [dueAt, setDueAt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (codesLoading || codes.length === 0) return;

    void (async () => {
      const { data, error: loadError } = await supabase
        .from('drivers')
        .select('driver_id, driver_name, admin_code, status')
        .in('admin_code', codes);

      if (loadError) {
        console.error('[AdminAppCreateJob] failed to load drivers:', loadError);
        return;
      }
      setDrivers((data ?? []) as Driver[]);
    })();
  }, [codes, codesLoading]);

  const selectedDriver = useMemo(
    () => drivers.find((d) => d.driver_id === driverId) ?? null,
    [drivers, driverId]
  );

  /** Turn a dropped pin back into a human address, best effort. */
  const reverseGeocode = ({ lat, lng }: { lat: number; lng: number }) => {
    if (!window.google?.maps) return;
    new google.maps.Geocoder().geocode({ location: { lat, lng } }, (results, status) => {
      if (status === 'OK' && results?.[0]) setDropoffAddress(results[0].formatted_address);
    });
  };

  const submit = async () => {
    setError('');

    if (!title.trim()) return setError('Give the job a title.');
    if (!selectedDriver) return setError('Choose which driver this job is for.');
    if (!dropoff) return setError('Set a drop-off location.');

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('tasks').insert({
        created_by: user!.id,
        assigned_user_id: user!.id,
        assigned_driver_id: selectedDriver.driver_id,
        admin_code: selectedDriver.admin_code,
        title: title.trim(),
        description: description.trim() || null,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        dropoff_radius_m: 150,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        status: 'assigned',
      });

      if (insertError) throw insertError;

      toast.success(`Job sent to ${selectedDriver.driver_name || 'driver'}`);
      navigate('/app/admin/tasks', { replace: true });
    } catch (err) {
      console.error('[AdminAppCreateJob] create failed:', err);
      setError(err instanceof Error ? err.message : 'Could not create the job.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-7 overflow-y-auto px-4 py-5">
        {/* Who */}
        <section>
          <Label className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <User className="h-3.5 w-3.5" />
            Driver
          </Label>

          {drivers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
              No drivers connected yet. Share a connection code first.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {drivers.map((driver) => {
                const isSelected = driver.driver_id === driverId;
                return (
                  <li key={driver.driver_id}>
                    <button
                      type="button"
                      onClick={() => setDriverId(driver.driver_id)}
                      className={cn(
                        'flex min-h-[52px] w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                        isSelected
                          ? 'border-primary bg-accent'
                          : 'border-border bg-card hover:bg-muted'
                      )}
                    >
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: getDriverAccent(driver.driver_id) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {driver.driver_name?.trim() || 'Unnamed driver'}
                      </span>
                      {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* What */}
        <section className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="title" className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
              <Package className="h-3.5 w-3.5" />
              Job title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Deliver 5 crates to Lekki"
              className="h-12"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-xs uppercase tracking-wider text-muted-foreground">
              Notes <span className="normal-case tracking-normal">(optional)</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Anything the driver should know"
              rows={3}
            />
          </div>
        </section>

        {/* Where */}
        <section className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            Drop-off
          </Label>

          {isLoaded ? (
            <AddressAutocomplete
              value={dropoffAddress}
              onChange={(address, lat, lng) => {
                setDropoffAddress(address);
                setDropoff({ lat, lng });
              }}
              placeholder="Search for the delivery address"
            />
          ) : (
            <div className="flex h-12 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading address search…
            </div>
          )}

          {/* Always offer the map as well: search fails for unnamed places
              (a gate, a dump site, a stretch of road), and dropping the pin
              directly is often faster than describing the address. */}
          {isLoaded && (
            <div className="overflow-hidden rounded-xl border border-border">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: 180 }}
                center={dropoff ?? MAP_FALLBACK_CENTER}
                zoom={dropoff ? 16 : 12}
                options={{
                  disableDefaultUI: true,
                  gestureHandling: 'greedy',
                  clickableIcons: false,
                  styles: getMapStyle(isDark),
                }}
                onClick={(e) => {
                  if (!e.latLng) return;
                  const next = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                  setDropoff(next);
                  reverseGeocode(next);
                }}
              >
                {dropoff && (
                  <Marker
                    position={dropoff}
                    draggable
                    onDragEnd={(e) => {
                      if (!e.latLng) return;
                      const next = { lat: e.latLng.lat(), lng: e.latLng.lng() };
                      setDropoff(next);
                      reverseGeocode(next);
                    }}
                  />
                )}
              </GoogleMap>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            {dropoff ? (
              <span className="telemetry text-success">
                Pinned · {dropoff.lat.toFixed(5)}, {dropoff.lng.toFixed(5)}
              </span>
            ) : (
              'Search above, or tap the map to drop a pin.'
            )}
          </p>
        </section>

        {/* When */}
        <section className="space-y-1.5">
          <Label htmlFor="due" className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <CalendarClock className="h-3.5 w-3.5" />
            Due <span className="normal-case tracking-normal">(optional)</span>
          </Label>
          <Input
            id="due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="h-12"
          />
        </section>

        <FormError message={error} />
      </div>

      <div
        className="border-t border-border bg-background px-4 py-3"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <Button className="h-12 w-full font-semibold" disabled={submitting} onClick={submit}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : (
            'Assign job'
          )}
        </Button>
      </div>
    </div>
  );
}
