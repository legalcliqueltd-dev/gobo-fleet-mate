import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Database, HardDrive, Clock, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPendingCount } from '@/utils/offlineLocationStore';

interface DebugStatusPanelProps {
  isTracking: boolean;
  lastUpdate: Date | null;
  pendingOfflineCount: number;
}

/**
 * Small collapsible debug panel for iPhone tracking diagnostics.
 * Shows native SQLite queue count, local IndexedDB mirror count,
 * last sync time, and tracking state.
 */
export default function DebugStatusPanel({
  isTracking,
  lastUpdate,
  pendingOfflineCount,
}: DebugStatusPanelProps) {
  const [open, setOpen] = useState(false);
  const [nativeCount, setNativeCount] = useState<number | null>(null);
  const [mirrorCount, setMirrorCount] = useState<number>(0);

  const isNativeIOS =
    Capacitor.getPlatform() === 'ios' && Capacitor.isNativePlatform();

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      // IndexedDB mirror count (works everywhere)
      try {
        const c = await getPendingCount();
        if (!cancelled) setMirrorCount(c);
      } catch {
        /* noop */
      }

      // Native Transistorsoft SQLite count (iOS only)
      if (isNativeIOS) {
        try {
          const mod = await import(
            '@transistorsoft/capacitor-background-geolocation'
          );
          const BG = (mod as any).default ?? mod;
          const count = await BG.getCount();
          if (!cancelled) setNativeCount(typeof count === 'number' ? count : 0);
        } catch {
          if (!cancelled) setNativeCount(null);
        }
      }
    };

    refresh();
    const id = setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isNativeIOS]);

  const formatTime = (d: Date | null) => {
    if (!d) return 'Never';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <div className="mx-4 mb-2 rounded-xl bg-card/95 backdrop-blur-sm border border-border shadow-lg overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2 flex items-center justify-between text-xs font-medium text-muted-foreground hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5" />
          Tracking Debug
          <span
            className={cn(
              'inline-block h-2 w-2 rounded-full',
              isTracking ? 'bg-success animate-pulse' : 'bg-muted-foreground/40'
            )}
          />
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 pb-3 pt-1 space-y-2 text-xs">
          <Row
            icon={<Activity className="h-3.5 w-3.5" />}
            label="Tracking"
            value={isTracking ? 'Active' : 'Stopped'}
            valueClass={isTracking ? 'text-success' : 'text-muted-foreground'}
          />
          {isNativeIOS && (
            <Row
              icon={<Database className="h-3.5 w-3.5" />}
              label="Native SQLite"
              value={nativeCount === null ? 'n/a' : `${nativeCount}`}
              valueClass={
                nativeCount && nativeCount > 0 ? 'text-warning' : 'text-foreground'
              }
            />
          )}
          <Row
            icon={<HardDrive className="h-3.5 w-3.5" />}
            label="Local Mirror"
            value={`${mirrorCount}`}
            valueClass={mirrorCount > 0 ? 'text-warning' : 'text-foreground'}
          />
          <Row
            icon={<HardDrive className="h-3.5 w-3.5" />}
            label="Pending (UI)"
            value={`${pendingOfflineCount}`}
            valueClass={
              pendingOfflineCount > 0 ? 'text-warning' : 'text-foreground'
            }
          />
          <Row
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Last Sync"
            value={formatTime(lastUpdate)}
            valueClass="text-muted-foreground"
          />
        </div>
      )}
    </div>
  );
}

function Row({
  icon,
  label,
  value,
  valueClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className={cn('font-semibold tabular-nums', valueClass)}>
        {value}
      </span>
    </div>
  );
}
