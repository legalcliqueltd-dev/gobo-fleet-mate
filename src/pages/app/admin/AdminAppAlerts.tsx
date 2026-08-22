import { useMemo, useState } from 'react';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, MapPin, ShieldCheck, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useSOSNotifications, type SOSEventWithDriver } from '@/hooks/useSOSNotifications';
import { Button } from '@/components/ui/button';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { getNavMapStyle } from '@/lib/mapStyles';
import { useTheme } from '@/contexts/ThemeContext';
import ConfirmDialog from '@/components/ConfirmDialog';
import LocationSheet, { type SheetFocus } from '@/components/admin/LocationSheet';
import { cn } from '@/lib/utils';

const isClosed = (status: string) => status === 'resolved' || status === 'cancelled';

/**
 * SOS inbox for the manager.
 *
 * Active incidents come first and stay visually loud; resolved ones collapse
 * into a quiet history that can be cleared in bulk. Every incident with
 * coordinates gets a one-tap route out to the phone's map app, which is the
 * fastest useful action when a driver is in trouble.
 */
export default function AdminAppAlerts() {
  const { user } = useAuth();
  const { recentSOS, refreshSOS } = useSOSNotifications();
  const { isDark } = useTheme();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const [busyId, setBusyId] = useState<string | null>(null);
  // Where the pull-up map is pointing. Nothing here ever leaves the app: the
  // incident list and the rest of the fleet stay one dismiss away.
  const [sheet, setSheet] = useState<SheetFocus | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const active = useMemo(() => recentSOS.filter((e) => !isClosed(e.status)), [recentSOS]);
  const closed = useMemo(() => recentSOS.filter((e) => isClosed(e.status)), [recentSOS]);

  const resolve = async (event: SOSEventWithDriver) => {
    if (!user) return;
    setBusyId(event.id);
    try {
      const { error } = await supabase
        .from('sos_events')
        .update({
          status: 'resolved',
          resolved_by: user.id,
          resolved_at: new Date().toISOString(),
        })
        .eq('id', event.id);
      if (error) throw error;
      toast.success('Incident resolved');
      await refreshSOS();
    } catch (err) {
      console.error('[AdminAppAlerts] resolve failed:', err);
      toast.error('Could not resolve this incident');
    } finally {
      setBusyId(null);
    }
  };

  const clearResolved = async () => {
    setClearing(true);
    try {
      const { error } = await supabase
        .from('sos_events')
        .delete()
        .in('id', closed.map((e) => e.id));
      if (error) throw error;
      toast.success(`Cleared ${closed.length} resolved incident${closed.length === 1 ? '' : 's'}`);
      setClearOpen(false);
      await refreshSOS();
    } catch (err) {
      console.error('[AdminAppAlerts] clear failed:', err);
      toast.error('Could not clear resolved incidents');
    } finally {
      setClearing(false);
    }
  };

  const renderCard = (event: SOSEventWithDriver, isActive: boolean) => {
    const hasLocation = event.latitude != null && event.longitude != null;
    return (
    <li
      key={event.id}
      className={cn(
        'rounded-xl border p-3.5',
        isActive ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'
      )}
      style={!isActive ? { boxShadow: 'var(--shadow-card)' } : undefined}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
            isActive ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          {isActive ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="truncate font-heading text-base font-bold capitalize text-foreground">
              {event.hazard?.replace(/_/g, ' ') || 'Emergency'}
            </h3>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
            </span>
          </div>

          <p className="mt-0.5 text-sm font-medium text-foreground">
            {event.driver_name || 'Unknown driver'}
          </p>

          {event.message && (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{event.message}</p>
          )}

          {event.photo_url && (
            <img
              src={event.photo_url}
              alt="Photo sent with the alert"
              className="mt-2.5 h-32 w-full rounded-lg object-cover"
              loading="lazy"
            />
          )}

          <div className="mt-3 flex gap-2">
            {hasLocation && (
              <Button
                variant="outline"
                className="h-10 flex-1 gap-1.5 text-xs"
                onClick={() =>
                  setSheet({
                    lat: event.latitude!,
                    lng: event.longitude!,
                    title: event.hazard?.replace(/_/g, ' ') || 'Emergency',
                    subtitle: event.driver_name || 'Unknown driver',
                    tone: 'alert',
                  })
                }
              >
                <MapPin className="h-4 w-4" />
                Show on map
              </Button>
            )}
            {isActive && (
              <Button
                className="h-10 flex-1 gap-1.5 text-xs"
                disabled={busyId === event.id}
                onClick={() => resolve(event)}
              >
                {busyId === event.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Resolve
              </Button>
            )}
          </div>
        </div>
      </div>
    </li>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {recentSOS.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
              <ShieldCheck className="h-7 w-7 text-success" />
            </span>
            <p className="font-heading text-base font-semibold text-foreground">All clear</p>
            <p className="max-w-[16rem] text-sm text-muted-foreground">
              No SOS alerts from your drivers. You'll be notified the moment one arrives.
            </p>
          </div>
        )}

        {active.length > 0 && (
          <section className="mb-5">
            <p className="eyebrow mb-2 px-0.5">Needs attention</p>
            <ul className="space-y-2.5">{active.map((e) => renderCard(e, true))}</ul>
          </section>
        )}

        {closed.length > 0 && (
          <section>
            <div className="mb-2 flex items-center justify-between px-0.5">
              <p className="eyebrow">Resolved</p>
              <button
                type="button"
                onClick={() => setClearOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear all
              </button>
            </div>
            <ul className="space-y-2.5">{closed.map((e) => renderCard(e, false))}</ul>
          </section>
        )}
      </div>

      <LocationSheet focus={sheet} onClose={() => setSheet(null)} />

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={`Clear ${closed.length} resolved incident${closed.length === 1 ? '' : 's'}?`}
        description="Resolved and cancelled alerts will be permanently deleted. Active alerts are not affected. This cannot be undone."
        confirmLabel={clearing ? 'Clearing…' : 'Clear resolved'}
        destructive
        onConfirm={clearResolved}
      />
    </div>
  );
}
