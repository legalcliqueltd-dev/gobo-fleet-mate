import { BatteryLow, BatteryMedium, BatteryFull, Gauge, Clock, Navigation, Signal } from 'lucide-react';
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
    if (accuracy <= 10) return 'text-success';
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

  return (
    <div className="driver-status-card mx-4 mb-4 rounded-xl bg-card/95 backdrop-blur-sm border border-border shadow-lg">
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        {/* Speed - Larger Display */}
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-foreground">{displaySpeed}</span>
            <span className="text-xs text-muted-foreground">km/h</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* Battery */}
        <div className="flex items-center gap-2">
          {getBatteryIcon()}
          <span className={cn("text-sm font-semibold", getBatteryColor())}>
            {batteryLevel}%
          </span>
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-border" />

        {/* GPS Accuracy */}
        {accuracy !== null && accuracy !== undefined && (
          <>
            <div className="flex items-center gap-1.5">
              <Signal className={cn("h-4 w-4", getAccuracyColor())} />
              <span className={cn("text-xs font-medium", getAccuracyColor())}>
                ±{Math.round(accuracy)}m
              </span>
            </div>
            <div className="h-8 w-px bg-border" />
          </>
        )}

        {/* Sync Status */}
        <div className="flex items-center gap-2">
          {isTracking ? (
            <Navigation className="h-4 w-4 text-success animate-pulse" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground font-medium">
            {formatSyncTime()}
          </span>
        </div>
      </div>
    </div>
  );
}
