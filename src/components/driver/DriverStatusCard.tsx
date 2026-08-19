import { BatteryLow, BatteryMedium, BatteryFull, Clock, Navigation, Signal, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverStatusCardProps {
  speed: number | null;
  batteryLevel: number;
  lastSyncTime: Date | null;
  isTracking: boolean;
  accuracy?: number | null;
}

export default function DriverStatusCard({
  speed,
  batteryLevel,
  lastSyncTime,
  isTracking,
  accuracy,
}: DriverStatusCardProps) {
  const getBatteryIcon = () => {
    if (batteryLevel <= 20) return <BatteryLow className="h-4 w-4 text-destructive" />;
    if (batteryLevel <= 50) return <BatteryMedium className="h-4 w-4 text-warning" />;
    return <BatteryFull className="h-4 w-4 text-success" />;
  };

  const getBatteryColor = () => {
    if (batteryLevel <= 20) return 'text-destructive';
    if (batteryLevel <= 50) return 'text-warning';
    return 'text-success';
  };

  const getAccuracyColor = () => {
    if (accuracy === null || accuracy === undefined) return 'text-muted-foreground';
    if (accuracy <= 30) return 'text-success';
    if (accuracy <= 100) return 'text-warning';
    return 'text-destructive';
  };

  const formatSyncTime = () => {
    if (!lastSyncTime) return 'Not synced';

    const now = new Date();
    const diffMs = now.getTime() - lastSyncTime.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  const displaySpeed = speed !== null ? Math.round(speed) : 0;

  const isStale = lastSyncTime
    ? (new Date().getTime() - lastSyncTime.getTime()) > 2 * 60 * 1000
    : false;

  return (
    <div className="driver-status-card mx-4 mb-4 rounded-xl">
      {isStale && isTracking && (
        <div className="flex items-center gap-2 border-b border-warning/30 px-4 py-2 text-warning">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs font-medium">Connection stale — last sync {formatSyncTime()}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        {/* Speed */}
        <div>
          <div className="flex items-baseline gap-1">
            <span className="telemetry text-3xl font-semibold leading-none text-foreground">
              {displaySpeed}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              km/h
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Speed
          </span>
        </div>

        <div className="h-9 w-px bg-border" />

        {/* Battery */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1.5">
            {getBatteryIcon()}
            <span className={cn('telemetry text-sm font-semibold', getBatteryColor())}>
              {batteryLevel}%
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Battery
          </span>
        </div>

        {/* GPS accuracy */}
        {accuracy !== null && accuracy !== undefined && (
          <>
            <div className="h-9 w-px bg-border" />
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1.5">
                <Signal className={cn('h-4 w-4', getAccuracyColor())} />
                <span className={cn('telemetry text-sm font-semibold', getAccuracyColor())}>
                  ±{Math.round(accuracy)}m
                </span>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                GPS
              </span>
            </div>
          </>
        )}

        <div className="h-9 w-px bg-border" />

        {/* Sync */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1.5">
            {isTracking ? (
              <Navigation className="h-4 w-4 animate-pulse text-success" />
            ) : (
              <Clock className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="telemetry text-sm font-medium text-muted-foreground">
              {formatSyncTime()}
            </span>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Sync
          </span>
        </div>
      </div>
    </div>
  );
}
