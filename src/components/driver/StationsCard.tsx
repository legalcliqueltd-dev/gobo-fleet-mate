import { useState } from 'react';
import { Camera, CheckCircle2, ChevronDown, ChevronUp, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { capturePhoto, dataUrlToFile, isNativePlatform } from '@/utils/nativeCamera';
import {
  attachReceipt,
  distanceMeters,
  kindMeta,
  type Station,
  type StationVisit,
} from '@/integrations/supabase/stations';
import { cn } from '@/lib/utils';

/**
 * Today's stations, on the driver's home screen.
 *
 * Collapsible like the task card and sync queue, because the map is the point
 * of this screen and nothing should permanently eat it.
 *
 * The receipt is captured with the camera only — `capturePhoto('camera')`
 * opens the live camera and the gallery is never offered, so a photo taken
 * last week cannot be resubmitted as today's proof.
 */
export default function StationsCard({
  stations,
  visitFor,
  position,
  onRefresh,
}: {
  stations: Station[];
  visitFor: (stationId: string) => StationVisit | null;
  position: { lat: number; lng: number } | null;
  onRefresh: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (stations.length === 0) return null;

  const outstanding = stations.filter((s) => {
    const visit = visitFor(s.id);
    return !visit || (s.requires_photo && visit.status !== 'completed');
  }).length;

  const submitReceipt = async (station: Station) => {
    const visit = visitFor(station.id);
    if (!visit) {
      toast.error(`Get to ${station.name} first — the receipt unlocks on arrival.`);
      return;
    }

    setBusyId(station.id);
    try {
      let file: File | null = null;

      if (isNativePlatform()) {
        const shot = await capturePhoto('camera');
        if (!shot) return; // cancelled
        file = dataUrlToFile(shot.dataUrl, `receipt-${Date.now()}.jpg`);
      } else {
        // Browser fallback: capture attribute still asks for the camera first.
        file = await new Promise<File | null>((resolve) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.capture = 'environment';
          input.onchange = () => resolve(input.files?.[0] ?? null);
          input.click();
        });
        if (!file) return;
      }

      const path = `${station.admin_code}/${station.id}/${visit.id}-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('station-receipts')
        .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from('station-receipts').getPublicUrl(data.path);

      await attachReceipt(visit.id, {
        photo_url: urlData.publicUrl,
        photo_lat: position?.lat ?? null,
        photo_lng: position?.lng ?? null,
        photo_distance_m: position
          ? Math.round(
              distanceMeters(position, { lat: station.latitude, lng: station.longitude })
            )
          : null,
      });

      toast.success(`Receipt sent for ${station.name}`);
      onRefresh();
    } catch (err) {
      console.error('[StationsCard] receipt failed:', err);
      toast.error('Could not send the receipt. It will need retrying.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="mx-3 mb-2 overflow-hidden rounded-2xl border border-border bg-card/95 backdrop-blur"
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left"
        aria-expanded={!collapsed}
      >
        <MapPin className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1">
          <span className="block text-sm font-semibold">Today's stops</span>
          <span className="block text-xs text-muted-foreground">
            {outstanding === 0
              ? 'All done — nice work'
              : `${outstanding} still to do of ${stations.length}`}
          </span>
        </span>
        {collapsed ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!collapsed && (
        <ul className="max-h-52 space-y-1.5 overflow-y-auto px-2.5 pb-2.5">
          {stations.map((station) => {
            const visit = visitFor(station.id);
            const arrived = Boolean(visit);
            const done = visit?.status === 'completed' || (arrived && !station.requires_photo);
            const meta = kindMeta(station.kind);

            return (
              <li
                key={station.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                  done ? 'border-success/30 bg-success/5' : 'border-border bg-background'
                )}
              >
                <span className="text-lg">{meta.emoji}</span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{station.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {done
                      ? 'Done'
                      : arrived
                        ? 'Arrived — receipt needed'
                        : `Not yet · ${station.radius_m} m zone`}
                  </p>
                  {station.notes && !done && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      {station.notes}
                    </p>
                  )}
                </div>

                {done ? (
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                ) : (
                  station.requires_photo && (
                    <button
                      type="button"
                      disabled={!arrived || busyId === station.id}
                      onClick={() => submitReceipt(station)}
                      className={cn(
                        'flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
                        arrived
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {busyId === station.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      Receipt
                    </button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
