import { useEffect, useState } from 'react';
import {
  CameraOff,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  PenLine,
  User,
  X,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import LocationSheet, { type SheetFocus } from '@/components/admin/LocationSheet';
import { cn } from '@/lib/utils';

export type JobForDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  due_at: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  driverName: string | null;
  accent: string;
};

type Report = {
  id: string;
  delivered: boolean;
  receiver_name: string | null;
  note: string | null;
  photos: unknown;
  signature_url: string | null;
  distance_to_dropoff_m: number | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string | null;
};

/** `photos` is jsonb, so it arrives as an array, a JSON string, or null. */
function asPhotoList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Everything about one job, including the proof the driver sent.
 *
 * The delivery photos were being written by the driver and then had nowhere to
 * be seen: tapping a job on the list opened the DRIVER, so the evidence for
 * the job itself was unreachable. That is the whole point of collecting it.
 */
export default function JobDetailSheet({
  job,
  onClose,
}: {
  job: JobForDetail | null;
  onClose: () => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [mapFocus, setMapFocus] = useState<SheetFocus | null>(null);

  useEffect(() => {
    if (!job) {
      setReport(null);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const { data } = await supabase
          .from('task_reports')
          .select('*')
          .eq('task_id', job.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setReport((data as Report) ?? null);
      } catch (err) {
        console.warn('[JobDetailSheet] report load failed:', err);
        setReport(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [job?.id]);

  if (!job) return null;

  const photos = asPhotoList(report?.photos);

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
        <h2 className="flex-1 truncate font-heading text-lg font-semibold">Job</h2>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
        <div>
          <div className="flex items-start gap-2.5">
            <span
              className="mt-1 h-10 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: job.accent }}
            />
            <div className="min-w-0 flex-1">
              <h3 className="font-heading text-xl font-bold leading-snug">{job.title}</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {job.driverName ?? 'Unassigned'}
              </p>
            </div>
          </div>

          {job.description && (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{job.description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Created {format(new Date(job.created_at), 'd MMM, HH:mm')}
            </span>
            {job.due_at && (
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Due {format(new Date(job.due_at), 'd MMM, HH:mm')}
              </span>
            )}
          </div>

          {job.dropoff_lat != null && job.dropoff_lng != null && (
            <button
              type="button"
              onClick={() =>
                setMapFocus({
                  lat: job.dropoff_lat!,
                  lng: job.dropoff_lng!,
                  title: job.title,
                  subtitle: 'Drop-off point',
                })
              }
              className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-border px-3 text-xs font-medium"
            >
              <MapPin className="h-4 w-4" />
              Show drop-off on map
            </button>
          )}
        </div>

        {/* Proof of delivery */}
        <section>
          <p className="eyebrow mb-2">Proof of delivery</p>

          {loading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}

          {!loading && !report && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border px-3.5 py-5">
              <CameraOff className="h-5 w-5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Nothing submitted yet. Proof appears here once the driver completes the job.
              </p>
            </div>
          )}

          {!loading && report && (
            <div
              className="space-y-3 rounded-2xl border border-border bg-card p-4"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2
                  className={cn(
                    'h-5 w-5 shrink-0',
                    report.delivered ? 'text-success' : 'text-warning'
                  )}
                />
                <p className="text-sm font-semibold">
                  {report.delivered ? 'Delivered' : 'Reported as not delivered'}
                </p>
              </div>

              {photos.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {photos.map((url) => (
                    <button key={url} type="button" onClick={() => setPreview(url)}>
                      <img
                        src={url}
                        alt="Delivery proof"
                        className="h-24 w-24 rounded-lg object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No photo was attached.</p>
              )}

              {report.receiver_name && (
                <p className="flex items-center gap-1.5 text-sm">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  Received by <span className="font-medium">{report.receiver_name}</span>
                </p>
              )}

              {report.note && (
                <p className="text-sm leading-relaxed text-muted-foreground">{report.note}</p>
              )}

              {report.signature_url && (
                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <PenLine className="h-3.5 w-3.5" />
                    Signature
                  </p>
                  <img
                    src={report.signature_url}
                    alt="Signature"
                    className="h-20 rounded-lg bg-white p-1"
                  />
                </div>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-2.5 text-xs text-muted-foreground">
                {report.created_at && (
                  <span className="telemetry">
                    {format(new Date(report.created_at), 'd MMM, HH:mm')}
                  </span>
                )}
                {report.distance_to_dropoff_m != null && (
                  <span className="telemetry">
                    {Math.round(report.distance_to_dropoff_m)} m from the drop-off
                  </span>
                )}
              </div>

              {report.latitude != null && report.longitude != null && (
                <button
                  type="button"
                  onClick={() =>
                    setMapFocus({
                      lat: report.latitude!,
                      lng: report.longitude!,
                      title: 'Where it was completed',
                      subtitle: job.driverName ?? undefined,
                    })
                  }
                  className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-primary"
                >
                  <MapPin className="h-4 w-4" />
                  Where it was completed
                </button>
              )}
            </div>
          )}
        </section>
      </div>

      {preview && (
        <button
          type="button"
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/90 p-4"
        >
          <img src={preview} alt="Delivery proof" className="max-h-[85vh] w-auto rounded-lg" />
        </button>
      )}

      <LocationSheet focus={mapFocus} onClose={() => setMapFocus(null)} />
    </div>
  );
}
