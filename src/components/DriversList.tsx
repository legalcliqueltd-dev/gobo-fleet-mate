import { useDriverLocations, DriverLocation } from '@/hooks/useDriverLocations';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Clock, MapPin, Navigation, User, Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';

type Props = {
  onDriverSelect?: (driver: DriverLocation) => void;
  selectedDriverId?: string | null;
};

export default function DriversList({ onDriverSelect, selectedDriverId }: Props) {
  const { drivers, loading, error } = useDriverLocations();

  const isRecent = (lastSeen: string | null) => {
    if (!lastSeen) return false;
    const diff = Date.now() - new Date(lastSeen).getTime();
    return diff < 15 * 60 * 1000; // 15 minutes
  };

  if (loading) {
    return (
      <Card variant="brutal">
        <CardHeader>
          <h3 className="font-heading font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Connected Drivers
          </h3>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading drivers…</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="brutal">
        <CardHeader>
          <h3 className="font-heading font-semibold flex items-center gap-2">
            <User className="h-4 w-4" />
            Connected Drivers
          </h3>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="brutal">
      <CardHeader>
        <h3 className="font-heading font-semibold flex items-center gap-2">
          <User className="h-4 w-4" />
          Connected Drivers
          {drivers.length > 0 && (
            <span className="ml-auto text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {drivers.length} active
            </span>
          )}
        </h3>
      </CardHeader>
      <CardContent>
        {drivers.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No drivers connected yet. Share your connection code with drivers using the Rocket app.
          </div>
        ) : (
          <ul className="space-y-2">
            {drivers.map((driver) => {
              const online = isRecent(driver.last_seen_at);
              return (
                <li key={driver.driver_id}>
                  <button
                    onClick={() => onDriverSelect?.(driver)}
                    className={clsx(
                      'w-full rounded-md border px-3 py-2 text-left transition-colors',
                      'hover:bg-accent/50',
                      selectedDriverId === driver.driver_id
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {online ? (
                          <Wifi className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <WifiOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">
                          {driver.driver_name || `Driver ${driver.driver_id.slice(0, 8)}`}
                        </span>
                        <span
                          className={clsx(
                            'text-[10px] px-1.5 py-0.5 rounded font-medium',
                            online
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {online ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}
                      </span>
                      {driver.speed !== null && driver.speed > 0 && (
                        <span className="flex items-center gap-1">
                          <Navigation className="h-3 w-3" />
                          {Math.round(driver.speed)} km/h
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {driver.last_seen_at
                          ? new Date(driver.last_seen_at).toLocaleTimeString()
                          : '—'}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
