import { useEffect, useState } from 'react';
import { BatteryMedium, ChevronDown, ChevronUp, CloudOff, Crosshair, RefreshCw, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  onDuty: boolean;
  isTracking: boolean;
  lastSyncAt: Date | null;
  batteryLevel: number;
  pendingCount: number;
  accuracy: number | null;
  onGoOnDuty: () => void;
  onGoOffDuty: () => void;
};

/** "43s ago" / "4 min ago". */
function since(d: Date | null): string {
  if (!d) return 'not yet';
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
}

function gpsQuality(accuracy: number | null): { label: string; good: boolean } {
  if (accuracy == null) return { label: 'Finding…', good: false };
  if (accuracy <= 30) return { label: `Good · ${Math.round(accuracy)} m`, good: true };
  if (accuracy <= 100) return { label: `Fair · ${Math.round(accuracy)} m`, good: false };
  return { label: `Weak · ${Math.round(accuracy)} m`, good: false };
}

/** One cell of the telemetry grid. Mono value, tiny mono label. */
function Stat({
  icon: Icon,
  label,
  value,
  tone = 'plain',
}: {
  icon: typeof Wifi;
  label: string;
  value: string;
  tone?: 'plain' | 'good' | 'warn';
}) {
  return (
    <div className="rounded-xl bg-brand-ink-foreground/[0.07] px-3 py-2.5">
      <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-brand-ink-foreground/50">
        <Icon className="h-3 w-3" />
        {label}
      </p>
      <p
        className={cn(
          'telemetry mt-1 truncate text-sm font-semibold',
          tone === 'good' && 'text-signal',
          tone === 'warn' && 'text-warning',
          tone === 'plain' && 'text-brand-ink-foreground'
        )}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Duty: the one piece of state everything else in the product depends on.
 *
 * This used to be a button that navigated to Settings — which was wrong twice
 * over. A driver tapping "On duty" is asking "is it actually working?", and
 * Settings answers a different question; and Settings is already reachable
 * from the menu, so the tap was spending the home screen's most prominent
 * control on a destination the driver did not ask for.
 *
 * Now the tap opens the answer in place: is the phone reaching the server,
 * how much is waiting on the phone, how good the fix is, and how much battery
 * is left to keep doing it. Those four readings are the whole of what "is it
 * working" means, and the off-duty control sits underneath them, where the
 * decision is actually informed.
 */
export default function DutyPanel({
  onDuty,
  isTracking,
  lastSyncAt,
  batteryLevel,
  pendingCount,
  accuracy,
  onGoOnDuty,
  onGoOffDuty,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  // Re-render so "synced 43s ago" stays true while he is looking at it.
  const [, tick] = useState(0);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [open]);

  // Collapsing the panel forgets a half-pressed off-duty.
  useEffect(() => {
    if (!open) setConfirmOff(false);
  }, [open]);

  const live = isTracking && online && pendingCount === 0;
  const gps = gpsQuality(accuracy);
  const batteryLow = batteryLevel <= 20;

  const syncLabel = !isTracking
    ? 'Stopped'
    : !online
      ? 'No signal'
      : pendingCount > 0
        ? 'Catching up'
        : 'Live';

  const summary = !onDuty
    ? 'Your manager cannot see you. Tap to go on duty.'
    : !isTracking
      ? 'Starting up…'
      : !online
        ? `Saving on this phone · ${pendingCount} waiting`
        : pendingCount > 0
          ? `Sending ${pendingCount} saved ${pendingCount === 1 ? 'point' : 'points'}`
          : lastSyncAt
            ? `Live · synced ${since(lastSyncAt)}`
            : 'Live · waiting for the first fix';

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[22px] transition-colors',
        onDuty ? 'bg-brand-ink text-brand-ink-foreground' : 'border border-warning/40 bg-warning/10'
      )}
    >
      {onDuty && (
        <div
          className={cn(
            'brand-pattern pointer-events-none absolute inset-0 transition-opacity',
            // Grain behind one line of text is texture; grain behind four
            // readings and a paragraph is noise.
            open ? 'opacity-30' : 'opacity-70'
          )}
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        onClick={() => (onDuty ? setOpen((o) => !o) : onGoOnDuty())}
        aria-expanded={onDuty ? open : undefined}
        className="relative flex w-full items-center gap-4 px-4 py-4 text-left"
      >
        <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
          {live && (
            <span className="absolute inline-flex h-3.5 w-3.5 animate-ping rounded-full bg-signal opacity-60" />
          )}
          <span
            className={cn(
              'relative h-3 w-3 rounded-full',
              !onDuty ? 'bg-warning' : live ? 'bg-signal' : 'bg-warning'
            )}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-heading text-lg font-bold tracking-tight">
            {onDuty ? 'On duty' : 'Off duty'}
          </span>
          <span
            className={cn(
              'block truncate text-xs',
              onDuty ? 'text-brand-ink-foreground/65' : 'text-muted-foreground'
            )}
          >
            {summary}
          </span>
        </span>

        {onDuty &&
          (open ? (
            <ChevronUp className="h-5 w-5 shrink-0 text-brand-ink-foreground/60" />
          ) : (
            <ChevronDown className="h-5 w-5 shrink-0 text-brand-ink-foreground/60" />
          ))}
      </button>

      {onDuty && open && (
        <div className="relative px-4 pb-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat
              icon={online ? Wifi : CloudOff}
              label="Sync"
              value={syncLabel}
              tone={live ? 'good' : 'warn'}
            />
            <Stat
              icon={RefreshCw}
              label="Saved here"
              value={pendingCount === 0 ? 'Nothing' : String(pendingCount)}
              tone={pendingCount === 0 ? 'good' : 'warn'}
            />
            <Stat
              icon={Crosshair}
              label="GPS"
              value={gps.label}
              tone={gps.good ? 'good' : 'warn'}
            />
            <Stat
              icon={BatteryMedium}
              label="Battery"
              value={`${batteryLevel}%`}
              tone={batteryLow ? 'warn' : 'plain'}
            />
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-brand-ink-foreground/50">
            {online
              ? 'Points are sent as you drive. Anything that fails is kept on the phone and sent when signal returns.'
              : 'No signal. Your location is still being recorded on this phone and will send itself when you are back online.'}
          </p>

          {confirmOff ? (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOff(false)}
                className="min-h-[44px] flex-1 rounded-xl bg-brand-ink-foreground/10 text-sm font-semibold text-brand-ink-foreground"
              >
                Stay on duty
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOff(false);
                  setOpen(false);
                  onGoOffDuty();
                }}
                className="min-h-[44px] flex-1 rounded-xl bg-warning text-sm font-semibold text-warning-foreground"
              >
                Yes, stop sharing
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmOff(true)}
              className="mt-3 min-h-[44px] w-full rounded-xl border border-brand-ink-foreground/20 text-sm font-semibold text-brand-ink-foreground/80"
            >
              Go off duty
            </button>
          )}
        </div>
      )}
    </section>
  );
}
