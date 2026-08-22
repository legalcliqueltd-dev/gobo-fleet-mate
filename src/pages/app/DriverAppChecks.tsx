import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Camera, Check, Loader2, ShieldCheck, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { trackingService } from '@/services/trackingService';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { capturePhoto, dataUrlToFile, isNativePlatform } from '@/utils/nativeCamera';
import {
  CHECK_ITEMS,
  PROBLEM_KINDS,
  checkedToday,
  createReport,
  fetchDriverReports,
  type CheckVerdict,
  type DriverReport,
} from '@/integrations/supabase/reports';
import { cn } from '@/lib/utils';

type Mode = 'check' | 'problem';

/**
 * Vehicle checks and problem reports.
 *
 * Both belong to the driver as much as the office. Photographing damage at
 * shift start is what stops him being blamed for it at shift end; reporting a
 * blocked road once, with a photo and a location, beats explaining it three
 * times over the phone.
 *
 * The checklist is deliberately six items. A longer one gets tapped through
 * without being read, which produces a record that proves nothing.
 */
export default function DriverAppChecks() {
  const { session } = useDriverSession();

  const [mode, setMode] = useState<Mode>('check');
  const [reports, setReports] = useState<DriverReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [verdicts, setVerdicts] = useState<Record<string, CheckVerdict>>({});
  const [problemKind, setProblemKind] = useState(PROBLEM_KINDS[0].id);
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<{ file: File; preview: string }[]>([]);

  const load = useCallback(async () => {
    if (!session?.driverId) return;
    setLoading(true);
    try {
      setReports(await fetchDriverReports(session.driverId));
    } catch (err) {
      console.warn('[DriverAppChecks] load failed:', err);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [session?.driverId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addPhoto = async () => {
    try {
      if (isNativePlatform()) {
        const shot = await capturePhoto('camera');
        if (!shot) return;
        setPhotos((prev) => [
          ...prev,
          { file: dataUrlToFile(shot.dataUrl, `report-${Date.now()}.jpg`), preview: shot.dataUrl },
        ]);
        return;
      }
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) setPhotos((prev) => [...prev, { file, preview: URL.createObjectURL(file) }]);
      };
      input.click();
    } catch {
      toast.error('Could not open the camera');
    }
  };

  const submit = async () => {
    if (!session) return;

    if (mode === 'check' && Object.keys(verdicts).length < CHECK_ITEMS.length) {
      toast.error('Mark every item before sending');
      return;
    }

    setSaving(true);
    try {
      const uploaded: string[] = [];
      for (const photo of photos) {
        const path = `${session.adminCode}/${session.driverId}/${Date.now()}-${uploaded.length}.jpg`;
        const { data, error } = await supabase.storage
          .from('driver-reports')
          .upload(path, photo.file, { contentType: photo.file.type });
        if (error) throw error;
        uploaded.push(
          supabase.storage.from('driver-reports').getPublicUrl(data.path).data.publicUrl
        );
      }

      // Position comes from the tracker, which already has a current fix —
      // asking the OS again here would prompt a second time for nothing.
      const last = trackingService.getState().lastLocation;

      await createReport({
        driver_id: session.driverId,
        admin_code: session.adminCode,
        type: mode === 'check' ? 'vehicle_check' : 'problem',
        details: mode === 'check' ? verdicts : { kind: problemKind },
        note: note.trim() || null,
        photos: uploaded,
        latitude: last?.latitude ?? null,
        longitude: last?.longitude ?? null,
        has_fault: mode === 'check' && Object.values(verdicts).includes('fault'),
      });

      toast.success(mode === 'check' ? 'Check sent' : 'Problem reported');
      setVerdicts({});
      setNote('');
      setPhotos([]);
      void load();
    } catch (err) {
      console.error('[DriverAppChecks] submit failed:', err);
      toast.error('Could not send. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const doneToday = checkedToday(reports);

  return (
    <DriverAppLayout>
      <div className="flex h-full flex-col">
        <div className="flex gap-2 border-b border-border px-4 py-3">
          {(
            [
              { id: 'check' as Mode, label: 'Vehicle check' },
              { id: 'problem' as Mode, label: 'Report a problem' },
            ]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id)}
              className={cn(
                'min-h-[40px] flex-1 rounded-lg text-xs font-semibold transition-colors',
                mode === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
          {mode === 'check' ? (
            <>
              {doneToday && (
                <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3.5 py-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-success" />
                  <p className="text-sm font-medium text-success">
                    You already checked in today. You can send another if something changed.
                  </p>
                </div>
              )}

              <div>
                <p className="eyebrow mb-1">Before you drive</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Mark anything wrong now. This is your record that the fault was already there
                  when you started.
                </p>
              </div>

              <div className="space-y-2.5">
                {CHECK_ITEMS.map((item) => {
                  const verdict = verdicts[item.id];
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-border bg-card p-3.5"
                      style={{ boxShadow: 'var(--shadow-card)' }}
                    >
                      <div className="mb-2.5">
                        <p className="text-sm font-semibold">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.hint}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setVerdicts((p) => ({ ...p, [item.id]: 'ok' }))}
                          className={cn(
                            'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors',
                            verdict === 'ok'
                              ? 'border-success bg-success text-success-foreground'
                              : 'border-border bg-background text-muted-foreground'
                          )}
                        >
                          <Check className="h-4 w-4" />
                          Fine
                        </button>
                        <button
                          type="button"
                          onClick={() => setVerdicts((p) => ({ ...p, [item.id]: 'fault' }))}
                          className={cn(
                            'flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border text-xs font-semibold transition-colors',
                            verdict === 'fault'
                              ? 'border-destructive bg-destructive text-destructive-foreground'
                              : 'border-border bg-background text-muted-foreground'
                          )}
                        >
                          <AlertTriangle className="h-4 w-4" />
                          Problem
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="eyebrow mb-1">Something in the way</p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Send it once, with a photo and your location, instead of explaining it on the
                  phone.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {PROBLEM_KINDS.map((kind) => (
                  <button
                    key={kind.id}
                    type="button"
                    onClick={() => setProblemKind(kind.id)}
                    className={cn(
                      'flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-medium transition-colors',
                      problemKind === kind.id
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'border-border bg-card text-muted-foreground'
                    )}
                  >
                    <span className="text-xl">{kind.emoji}</span>
                    {kind.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Photos + note, shared by both modes */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Photos {mode === 'check' && '(optional)'}</p>
            <div className="flex flex-wrap gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative">
                  <img
                    src={photo.preview}
                    alt=""
                    className="h-20 w-20 rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute -right-1.5 -top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-background shadow"
                    aria-label="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addPhoto}
                className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-card text-[10px] font-medium text-muted-foreground"
              >
                <Camera className="h-5 w-5" />
                Add
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium">Note {mode === 'check' && '(optional)'}</p>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                mode === 'check'
                  ? 'Nearside rear tyre looks low'
                  : 'Road flooded at the junction, cannot pass'
              }
              rows={3}
            />
          </div>

          {/* Recent history, so he can see his own trail */}
          {!loading && reports.length > 0 && (
            <div>
              <p className="eyebrow mb-3">Recently sent</p>
              <ul className="space-y-2">
                {reports.slice(0, 6).map((report) => (
                  <li
                    key={report.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                        report.has_fault || report.type === 'problem'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-success/15 text-success'
                      )}
                    >
                      {report.type === 'problem' ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {report.type === 'problem' ? 'Problem reported' : 'Vehicle check'}
                        {report.has_fault && ' — fault noted'}
                      </p>
                      <p className="telemetry text-xs text-muted-foreground">
                        {format(new Date(report.created_at), 'EEE d MMM, HH:mm')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div
          className="border-t border-border bg-background px-4 py-3"
          style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <Button className="h-12 w-full gap-2 font-semibold" disabled={saving} onClick={submit}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {mode === 'check' ? 'Send check' : 'Send report'}
          </Button>
        </div>
      </div>
    </DriverAppLayout>
  );
}
