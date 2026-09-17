import { Car, ClipboardList, History, Radar, User, X, ZoomIn } from 'lucide-react';
import { usePlaceName } from '@/hooks/usePlaceName';
import {
  formatLastSeen,
  OFFLINE_REASON_TEXT,
  STATUS_CLASSES,
  STATUS_LABEL,
  type OfflineReason,
  type VehicleStatus,
} from '@/lib/driverStatus';
import { cn } from '@/lib/utils';

export type FocusVehicle = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  speedKmh: number;
  accuracyM?: number | null;
  lastSeen: string | null;
  status: VehicleStatus;
  offlineReason: OfflineReason;
  accent: string;
};

type Action = {
  icon: typeof Car;
  label: string;
  onClick: () => void;
};

/**
 * What you get when you tap a vehicle — modelled on Find My's item card.
 *
 * Tapping a marker used to do nothing but tint it. Everything a manager
 * actually wanted next — where is that, how fresh is it, show me his day —
 * meant opening the list, finding the same driver again, and tapping through.
 *
 * Find My's card is worth copying because of what it leaves out. No table of
 * fields: a name, a place in words, one line saying how much to trust it, and
 * a short row of round buttons for the things you might do about it. The
 * place line is the part that does the heavy lifting — "Awolowo Road, Ikoyi"
 * answers the question a pin on a grey rectangle never could.
 */
export default function VehicleFocusCard({
  vehicle,
  onClose,
  onZoom,
  onHistory,
  onDetails,
  onAssignJob,
}: {
  vehicle: FocusVehicle;
  onClose: () => void;
  onZoom: () => void;
  onHistory: () => void;
  onDetails: () => void;
  onAssignJob: () => void;
}) {
  const place = usePlaceName(vehicle.lat, vehicle.lng);
  const classes = STATUS_CLASSES[vehicle.status];
  const live = vehicle.status === 'moving';

  const actions: Action[] = [
    { icon: ZoomIn, label: 'Zoom in', onClick: onZoom },
    { icon: History, label: 'History', onClick: onHistory },
    { icon: User, label: 'Driver', onClick: onDetails },
    { icon: ClipboardList, label: 'Send job', onClick: onAssignJob },
  ];

  return (
    <div
      className="rounded-3xl border border-border bg-background/95 p-4 backdrop-blur-xl"
      style={{ boxShadow: '0 12px 32px -12px hsl(224 44% 11% / 0.35)' }}
    >
      <div className="flex items-start gap-3.5">
        {/* Accent circle, pulsing only while the vehicle is genuinely live —
            a steady ring on a parked van would be a lie told every second. */}
        <span className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          {live && (
            <span
              className="absolute inset-0 animate-ping rounded-full opacity-30"
              style={{ backgroundColor: vehicle.accent }}
            />
          )}
          <span
            className="relative flex h-14 w-14 items-center justify-center rounded-full"
            style={{
              backgroundColor: vehicle.accent,
              opacity: vehicle.status === 'offline' ? 0.55 : 1,
            }}
          >
            <Car className="h-7 w-7 text-white" />
          </span>
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="truncate font-heading text-xl font-bold leading-tight tracking-tight">
            {vehicle.name}
          </h3>

          {/* The place, not the coordinates. Absent until geocoding answers,
              and absent forever if it cannot — never a placeholder. */}
          {place && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{place}</p>
          )}

          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                classes.chip
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', classes.dot)} />
              {STATUS_LABEL[vehicle.status]}
            </span>

            {live && (
              <span className="telemetry font-semibold text-foreground">
                {Math.round(vehicle.speedKmh)} km/h
              </span>
            )}

            <span
              className={cn(
                vehicle.offlineReason === 'just_dropped'
                  ? 'font-medium text-warning'
                  : 'text-muted-foreground'
              )}
            >
              {vehicle.offlineReason
                ? OFFLINE_REASON_TEXT[vehicle.offlineReason]
                : formatLastSeen(vehicle.lastSeen)}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* How much to trust the dot. Find My says "accurate to 10 m" for the
          same reason: without it, a position 80 m out looks like a lie. */}
      {vehicle.accuracyM != null && Number.isFinite(vehicle.accuracyM) && (
        <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Radar className="h-3.5 w-3.5" />
          Accurate to about {Math.round(vehicle.accuracyM)} m
        </p>
      )}

      <div className="mt-4 flex items-start justify-between gap-1">
        {actions.map(({ icon: Icon, label, onClick }) => (
          <button
            key={label}
            type="button"
            onClick={onClick}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-xl py-1 transition-opacity active:opacity-60"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent">
              <Icon className="h-5 w-5 text-primary" />
            </span>
            <span className="truncate text-[11px] font-medium text-muted-foreground">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
