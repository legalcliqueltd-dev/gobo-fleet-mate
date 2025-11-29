import { useDriverLocations, DriverLocation } from '@/hooks/useDriverLocations';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Clock, MapPin, Navigation, User, Wifi, WifiOff, ExternalLink, Trash2, Unlink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
    return diff < 15 * 60 * 1000;
  };

  const handleQuickDisconnect = async (e: React.MouseEvent, driver: DriverLocation) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Disconnect ${driver.driver_name || 'this driver'}?`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'disconnected' })
        .eq('driver_id', driver.driver_id);
      if (error) throw error;
      toast.success('Driver disconnected');
    } catch (err) {
      console.error('Error disconnecting:', err);
      toast.error('Failed to disconnect driver');
    }
  };

  const handleQuickDelete = async (e: React.MouseEvent, driver: DriverLocation) => {
    e.stopPropagation();
    const confirmed = window.confirm(`Delete ${driver.driver_name || 'this driver'} and all their data?`);
    if (!confirmed) return;

    try {
      await supabase.from('driver_locations').delete().eq('driver_id', driver.driver_id);
      const { error } = await supabase.from('drivers').delete().eq('driver_id', driver.driver_id);
      if (error) throw error;
      toast.success('Driver deleted');
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error('Failed to delete driver');
    }
  };

  if (loading) {
    return (
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardHeader className="pb-3">
          <h3 className="font-heading font-semibold flex items-center gap-2 text-lg">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <User className="h-4 w-4 text-primary" />
            </div>
            Connected Drivers
          </h3>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-2 border-destructive/20">
        <CardHeader className="pb-3">
          <h3 className="font-heading font-semibold flex items-center gap-2 text-lg">
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
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading font-semibold flex items-center gap-2 text-lg">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <User className="h-4 w-4 text-primary" />
            </div>
            Connected Drivers
          </h3>
          {drivers.length > 0 && (
            <span className="text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-full font-semibold">
              {drivers.length} active
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {drivers.length === 0 ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
              <User className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No drivers connected yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Share your connection code with drivers.</p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-[300px] overflow-y-auto">
            {drivers.map((driver) => {
              const online = isRecent(driver.last_seen_at);
              return (
                <li key={driver.driver_id}>
                  <div
                    className={clsx(
                      'rounded-xl border-2 p-3 transition-all cursor-pointer',
                      'hover:border-primary/50 hover:bg-primary/5',
                      selectedDriverId === driver.driver_id
                        ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                        : 'border-border bg-card/50'
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => onDriverSelect?.(driver)} className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <div className={clsx('p-1 rounded-full', online ? 'bg-success/20' : 'bg-muted')}>
                            {online ? (
                              <Wifi className="h-3.5 w-3.5 text-success" />
                            ) : (
                              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <span className="font-semibold">
                            {driver.driver_name || `Driver ${driver.driver_id.slice(0, 8)}`}
                          </span>
                          <span className={clsx(
                            'text-[10px] px-2 py-0.5 rounded-full font-bold uppercase',
                            online ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                          )}>
                            {online ? 'Live' : 'Offline'}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {driver.latitude.toFixed(4)}, {driver.longitude.toFixed(4)}
                          </span>
                          {driver.speed !== null && driver.speed > 0 && (
                            <span className="flex items-center gap-1 text-success">
                              <Navigation className="h-3 w-3" />
                              {Math.round(driver.speed)} km/h
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {driver.last_seen_at ? new Date(driver.last_seen_at).toLocaleTimeString() : '—'}
                          </span>
                        </div>
                      </button>
                      <div className="flex items-center gap-1">
                        <Link to={`/driver/${driver.driver_id}`} className="p-1.5 rounded-lg hover:bg-primary/10" title="Details">
                          <ExternalLink className="h-4 w-4 text-primary" />
                        </Link>
                        <button onClick={(e) => handleQuickDisconnect(e, driver)} className="p-1.5 rounded-lg hover:bg-warning/10" title="Disconnect">
                          <Unlink className="h-4 w-4 text-warning" />
                        </button>
                        <button onClick={(e) => handleQuickDelete(e, driver)} className="p-1.5 rounded-lg hover:bg-destructive/10" title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
