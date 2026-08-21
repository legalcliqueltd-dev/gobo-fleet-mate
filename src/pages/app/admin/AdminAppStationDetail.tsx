import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CameraOff,
  CheckCircle2,
  Loader2,
  Pencil,
  Trash2,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import StationEditorSheet from '@/components/admin/StationEditorSheet';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import {
  deleteStation,
  fetchStationVisits,
  kindMeta,
  type Station,
  type StationVisit,
} from '@/integrations/supabase/stations';
import { cn } from '@/lib/utils';

/** The last 14 calendar days, oldest first — the attendance strip. */
function lastDays(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (count - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

/**
 * One station's record: who attended, when, and the photo that proves it.
 *
 * The attendance strip answers "which days were missed?" at a glance, which
 * is the question a manager actually opens this screen to ask. Below it, each
 * visit shows arrival and receipt as separate facts — a driver who was
 * present but never photographed reads as "no receipt", not as absent.
 */
export default function AdminAppStationDetail() {
  const { stationId } = useParams<{ stationId: string }>();
  const navigate = useNavigate();
  const { codes } = useAdminCodes();

  const [station, setStation] = useState<Station | null>(null);
  const [visits, setVisits] = useState<StationVisit[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [preview, setPreview] = useState<StationVisit | null>(null);

  const load = useCallback(async () => {
    if (!stationId) return;
    setLoading(true);
    try {
      const { data: stationRow, error } = await (supabase as any)
        .from('stations')
        .select('*')
        .eq('id', stationId)
        .maybeSingle();
      if (error) throw error;
      setStation(stationRow as Station);

      const rows = await fetchStationVisits(stationId);
      setVisits(rows);

      const ids = [...new Set(rows.map((v) => v.driver_id))];
      if (ids.length) {
        const { data: drivers } = await supabase
          .from('drivers')
          .select('driver_id, driver_name')
          .in('driver_id', ids);
        setDriverNames(
          Object.fromEntries((drivers ?? []).map((d) => [d.driver_id, d.driver_name ?? 'Driver']))
        );
      }
    } catch (err) {
      console.error('[AdminAppStationDetail] load failed:', err);
      toast.error('Could not load this station');
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(() => lastDays(14), []);
  const visitsByDate = useMemo(() => {
    const map: Record<string, StationVisit[]> = {};
    visits.forEach((v) => {
      (map[v.visit_date] ??= []).push(v);
    });
    return map;
  }, [visits]);

  const completedCount = visits.filter((v) => v.status === 'completed').length;
  const missedDays = days.filter((d) => !visitsByDate[d]?.length).length;

  const remove = async () => {
    if (!stationId) return;
    try {
      await deleteStation(stationId);
      toast.success('Station deleted');
      navigate('/app/admin/stations', { replace: true });
    } catch (err) {
      console.error('[AdminAppStationDetail] delete failed:', err);
      toast.error('Could not delete the station');
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!station) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-heading font-semibold">Station not found</p>
        <Button variant="outline" onClick={() => navigate('/app/admin/stations')}>
          Back to stations
        </Button>
      </div>
    );
  }

  const meta = kindMeta(station.kind);

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-border bg-card px-4 py-4">
        <button
          type="button"
          onClick={() => navigate('/app/admin/stations')}
          className="mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Stations
        </button>

        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
            style={{ backgroundColor: `${station.color}1f` }}
          >
            {meta.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-heading text-xl font-bold">{station.name}</h2>
            <p className="telemetry text-xs text-muted-foreground">
              {station.radius_m} m · {station.min_dwell_seconds}s ·{' '}
              {station.requires_photo ? 'receipt required' : 'no receipt'}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Button variant="outline" className="h-11 flex-1 gap-1.5 text-xs" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 gap-1.5 text-xs text-destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="space-y-7 px-4 py-5">
        {/* Attendance strip */}
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <p className="eyebrow">Last 14 days</p>
            <p className="text-xs text-muted-foreground">
              <span className="telemetry font-semibold text-foreground">{completedCount}</span>{' '}
              with receipt ·{' '}
              <span className="telemetry font-semibold text-destructive">{missedDays}</span> missed
            </p>
          </div>

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
        </section>

        {/* Visit log */}
        <section>
          <p className="eyebrow mb-3">Visit log</p>

          {visits.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              No visits recorded yet.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {visits.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  {v.photo_url ? (
                    <button type="button" onClick={() => setPreview(v)} className="shrink-0">
                      <img
                        src={v.photo_url}
                        alt="Receipt"
                        className="h-14 w-14 rounded-lg object-cover"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-warning/10">
                      <CameraOff className="h-5 w-5 text-warning" />
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
                    <p className="telemetry mt-0.5 text-[11px] text-muted-foreground">
                      {v.dwell_seconds != null && `${v.dwell_seconds}s stay`}
                      {v.closest_distance_m != null &&
                        ` · ${Math.round(v.closest_distance_m)} m away`}
                    </p>
                    {v.flag_reason && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        {v.flag_reason}
                      </p>
                    )}
                  </div>

                  <span className="shrink-0">
                    {v.status === 'completed' ? (
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    ) : (
                      <Camera className="h-5 w-5 text-warning" />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Receipt viewer */}
      {preview?.photo_url && (
        <button
          type="button"
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black/90 p-4"
        >
          <img src={preview.photo_url} alt="Receipt" className="max-h-[70vh] w-auto rounded-lg" />
          <div className="mt-4 text-center text-white">
            <p className="text-sm font-semibold">
              {driverNames[preview.driver_id] ?? preview.driver_id}
            </p>
            <p className="telemetry mt-1 text-xs opacity-80">
              {preview.photo_submitted_at &&
                format(new Date(preview.photo_submitted_at), 'd MMM yyyy, HH:mm')}
              {preview.photo_distance_m != null &&
                ` · ${Math.round(preview.photo_distance_m)} m from the station`}
            </p>
          </div>
        </button>
      )}

      {editing && (
        <StationEditorSheet
          station={station}
          adminCodes={codes}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${station.name}?`}
        description="The station and its entire visit history, including the photo receipts, are permanently deleted. This cannot be undone."
        confirmLabel="Delete station"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
