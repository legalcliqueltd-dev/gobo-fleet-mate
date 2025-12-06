import { useMemo, useState, useCallback, useEffect } from 'react';
import { useDeviceLocations } from '../hooks/useDeviceLocations';
import { useDriverLocations, DriverLocation } from '../hooks/useDriverLocations';
import LiveDriverMap from '../components/map/LiveDriverMap';
import DriversList from '../components/DriversList';
import GeofenceAlerts from '../components/GeofenceAlerts';
import TempTrackingManager from '../components/TempTrackingManager';
import { Clock, Plus, ExternalLink, TrendingUp, Car, Users, Activity, Trash2, Link2 } from 'lucide-react';
import clsx from 'clsx';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Dashboard() {
  const { items, markers, loading, error } = useDeviceLocations();
  const { drivers } = useDriverLocations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const focusId = searchParams.get('focus');
    if (focusId) {
      if (focusId.startsWith('driver-')) {
        setSelectedDriverId(focusId.replace('driver-', ''));
        setSelectedId(null);
      } else {
        setSelectedId(focusId);
        setSelectedDriverId(null);
      }
    }
  }, [searchParams]);

  // Convert device markers for LiveDriverMap
  const deviceMarkers = useMemo(() => {
    return markers.map(m => ({
      device_id: m.device_id,
      name: m.name || 'Device',
      status: (m.status || 'offline') as 'active' | 'idle' | 'offline',
      latitude: m.latitude,
      longitude: m.longitude,
      speed: m.speed || null,
      timestamp: m.timestamp || null,
    }));
  }, [markers]);

  const handleDriverSelect = useCallback((driver: DriverLocation) => {
    setSelectedDriverId(driver.driver_id);
    setSelectedId(null);
  }, []);

  const handleLiveDriverSelect = useCallback((driverId: string) => {
    setSelectedDriverId(driverId);
    setSelectedId(null);
  }, []);

  const handleDeleteDevice = async (deviceId: string) => {
    const device = items.find(d => d.id === deviceId);
    const confirmed = window.confirm(`Delete ${device?.name || 'this device'} and all its data?`);
    if (!confirmed) return;

    try {
      await supabase.from('locations').delete().eq('device_id', deviceId);
      await supabase.from('trips').delete().eq('device_id', deviceId);
      const { error } = await supabase.from('devices').delete().eq('id', deviceId);
      if (error) throw error;
      toast.success('Device deleted');
      setSelectedId(null);
    } catch (err) {
      console.error('Error deleting device:', err);
      toast.error('Failed to delete device');
    }
  };

  const handleDeleteTempHistory = async () => {
    const confirmed = window.confirm('Delete all temporary tracking sessions?');
    if (!confirmed) return;

    try {
      const { error } = await supabase.from('temp_track_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast.success('Temporary tracking history cleared');
    } catch (err) {
      console.error('Error clearing temp history:', err);
      toast.error('Failed to clear temporary history');
    }
  };

  const activeDevices = items.filter(d => d.status === 'active').length;
  const activeDrivers = drivers.filter(d => 
    d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 15 * 60 * 1000
  ).length;

  return (
    <div className="space-y-6">
      {/* Stats Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/20">
                <Car className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{items.length}</p>
                <p className="text-xs text-muted-foreground">Total Devices</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-2 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-success/20">
                <Users className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeDrivers}</p>
                <p className="text-xs text-muted-foreground">Active Drivers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-2 border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-warning/20">
                <Activity className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeDevices}</p>
                <p className="text-xs text-muted-foreground">Online Now</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link to="/analytics" className="block">
          <Card className="bg-gradient-to-br from-fleet-blue/10 to-fleet-blue/5 border-2 border-fleet-blue/20 hover:border-fleet-blue/40 transition-all h-full">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-fleet-blue/20">
                  <TrendingUp className="h-5 w-5 text-fleet-blue" />
                </div>
                <div>
                  <p className="font-semibold">Analytics</p>
                  <p className="text-xs text-muted-foreground">View Reports →</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content - Map First */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
        <section className="order-1">
          <LiveDriverMap
            selectedDriverId={selectedDriverId}
            onDriverSelect={handleLiveDriverSelect}
            showDevices={true}
            devices={deviceMarkers}
          />
        </section>

        <aside className="order-2 space-y-4">
          {/* Devices Card */}
          <Card className="border-2 border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold flex items-center gap-2 text-lg">
                  <div className="p-1.5 rounded-lg bg-primary/20">
                    <Car className="h-4 w-4 text-primary" />
                  </div>
                  Your Devices
                </h3>
                <Link to="/devices/new">
                  <Button variant="outline" size="sm" className="h-8">
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {loading && (
                <div className="flex items-center justify-center py-6">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              )}
              {error && <div className="text-sm text-destructive">{error}</div>}
              {!loading && items.length === 0 && (
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <Car className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">No devices yet.</p>
                  <Link to="/devices/new" className="text-sm text-primary hover:underline">Add your first device →</Link>
                </div>
              )}
              <ul className="space-y-2 max-h-[280px] overflow-y-auto">
                {items.map((d) => {
                  const hasFix = !!d.latest;
                  return (
                    <li key={d.id}>
                      <div className={clsx(
                        'rounded-xl border-2 p-3 transition-all hover:border-primary/50 hover:bg-primary/5',
                        selectedId === d.id ? 'border-primary bg-primary/10 shadow-lg' : 'border-border bg-card/50'
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <button onClick={() => setSelectedId(d.id)} className="text-left flex-1">
                            <div className="flex items-center gap-2">
                              <div className={clsx(
                                'h-2.5 w-2.5 rounded-full',
                                d.status === 'active' ? 'bg-success animate-pulse' : d.status === 'idle' ? 'bg-warning' : 'bg-muted-foreground'
                              )} />
                              <span className="font-semibold">{d.name ?? 'Unnamed'}</span>
                              {d.is_temporary && (
                                <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-purple-500/20 text-purple-400 font-bold">TEMP</span>
                              )}
                            </div>
                            <div className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {hasFix ? new Date(d.latest!.timestamp).toLocaleString() : 'No location'}
                            </div>
                          </button>
                          <div className="flex items-center gap-1">
                            <Link to={`/devices/${d.id}`} className="p-1.5 rounded-lg hover:bg-primary/10" title="Details">
                              <ExternalLink className="h-4 w-4 text-primary" />
                            </Link>
                            <button onClick={() => handleDeleteDevice(d.id)} className="p-1.5 rounded-lg hover:bg-destructive/10" title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <DriversList onDriverSelect={handleDriverSelect} selectedDriverId={selectedDriverId} />

          <Card className="border-2 border-border">
            <CardHeader className="pb-3">
              <h3 className="font-heading font-semibold text-sm">Quick Actions</h3>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/temp-tracking">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <Link2 className="h-4 w-4 mr-2" />
                  Temporary Tracking Links
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="w-full justify-start text-destructive hover:bg-destructive/10" onClick={handleDeleteTempHistory}>
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Temp History
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <TempTrackingManager />
      <GeofenceAlerts />

      <Link to="/devices/new" className="lg:hidden fixed bottom-6 right-6 z-20 safe-bottom">
        <Button variant="default" size="icon" className="rounded-xl h-14 w-14 shadow-xl">
          <Plus className="h-6 w-6" />
        </Button>
      </Link>
    </div>
  );
}
