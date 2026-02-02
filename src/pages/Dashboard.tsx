import { useMemo, useState, useCallback, useEffect } from 'react';
import { useDeviceLocations } from '../hooks/useDeviceLocations';
import { useDriverLocations, DriverLocation } from '../hooks/useDriverLocations';
import LiveDriverMap from '../components/map/LiveDriverMap';
import DriversList from '../components/DriversList';
import GeofenceAlerts from '../components/GeofenceAlerts';
import TempTrackingManager from '../components/TempTrackingManager';
import PaymentWall from '../components/PaymentWall';
import { Clock, Plus, ExternalLink, TrendingUp, Car, Users, Activity, Trash2, Link2, Download, Smartphone, Timer } from 'lucide-react';
import { ShareAppButton } from '@/components/ShareAppButton';
import clsx from 'clsx';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const APK_DOWNLOAD_URL = "https://fleettrackmate.com/downloads/FleetTrackMate.apk";
export default function Dashboard() {
  const { items, markers, loading, error } = useDeviceLocations();
  const { drivers } = useDriverLocations();
  const { subscription, hasFullAccess, refreshSubscription } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  // Handle payment success callback
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    if (paymentStatus === 'success') {
      toast.success('Payment successful! Welcome to FleetTrackMate Pro.');
      // Refresh subscription status
      refreshSubscription();
    } else if (paymentStatus === 'cancelled') {
      toast.info('Payment cancelled.');
    }
  }, [searchParams, refreshSubscription]);

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

  // Show payment wall if trial expired and no active subscription
  if (subscription.status === 'expired') {
    return <PaymentWall />;
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Trial Banner */}
      {subscription.status === 'trial' && subscription.trialDaysRemaining > 0 && (
        <Card className="border-warning/50 bg-warning/10">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">
                  Free Trial: {subscription.trialDaysRemaining} day{subscription.trialDaysRemaining !== 1 ? 's' : ''} remaining
                </span>
              </div>
              <Link to="/settings">
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  Upgrade Now
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Subscription Badge */}
      {subscription.status === 'active' && subscription.plan && (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">
            {subscription.plan === 'pro' ? '⭐ Pro Plan' : '⚡ Basic Plan'}
          </Badge>
        </div>
      )}

      {/* Stats Banner */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 md:p-2.5 rounded-lg md:rounded-xl bg-primary/20 shrink-0">
                <Car className="h-4 w-4 md:h-5 md:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{items.length}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">Total Devices</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 md:p-2.5 rounded-lg md:rounded-xl bg-success/20 shrink-0">
                <Users className="h-4 w-4 md:h-5 md:w-5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{activeDrivers}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">Active Drivers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-2 md:p-2.5 rounded-lg md:rounded-xl bg-warning/20 shrink-0">
                <Activity className="h-4 w-4 md:h-5 md:w-5 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-xl md:text-2xl font-bold">{activeDevices}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">Online Now</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link to="/analytics" className="block">
          <Card className="bg-gradient-to-br from-fleet-blue/10 to-fleet-blue/5 border border-fleet-blue/20 hover:border-fleet-blue/40 transition-all h-full">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="p-2 md:p-2.5 rounded-lg md:rounded-xl bg-fleet-blue/20 shrink-0">
                  <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-fleet-blue" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm md:text-base font-semibold">Analytics</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground truncate">View Reports →</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content - Map First */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] gap-4 md:gap-6">
        <section className="order-2 lg:order-1 min-h-[300px] md:min-h-[400px]">
          <LiveDriverMap
            selectedDriverId={selectedDriverId}
            onDriverSelect={handleLiveDriverSelect}
            showDevices={true}
            devices={deviceMarkers}
          />
        </section>

        <aside className="order-1 lg:order-2 space-y-3 md:space-y-4">
          {/* Devices Card */}
          <Card className="border border-border">
            <CardHeader className="p-3 md:pb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold flex items-center gap-2 text-sm md:text-base">
                  <div className="p-1 md:p-1.5 rounded-lg bg-primary/20">
                    <Car className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                  </div>
                  Your Devices
                </h3>
                <Link to="/devices/new">
                  <Button variant="outline" size="sm" className="h-7 md:h-8 text-xs md:text-sm">
                    <Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" /> Add
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {loading && (
                <div className="flex items-center justify-center py-4 md:py-6">
                  <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-primary"></div>
                </div>
              )}
              {error && <div className="text-xs md:text-sm text-destructive">{error}</div>}
              {!loading && items.length === 0 && (
                <div className="text-center py-4 md:py-6">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2 md:mb-3">
                    <Car className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground">No devices yet.</p>
                  <Link to="/devices/new" className="text-xs md:text-sm text-primary hover:underline">Add your first device →</Link>
                </div>
              )}
              <ul className="space-y-2 max-h-[200px] md:max-h-[280px] overflow-y-auto">
                {items.map((d) => {
                  const hasFix = !!d.latest;
                  return (
                    <li key={d.id}>
                      <div className={clsx(
                        'rounded-lg md:rounded-xl border p-2 md:p-3 transition-all hover:border-primary/50 hover:bg-primary/5',
                        selectedId === d.id ? 'border-primary bg-primary/10 shadow-md' : 'border-border bg-card/50'
                      )}>
                        <div className="flex items-start justify-between gap-2">
                          <button onClick={() => setSelectedId(d.id)} className="text-left flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className={clsx(
                                'h-2 w-2 md:h-2.5 md:w-2.5 rounded-full shrink-0',
                                d.status === 'active' ? 'bg-success animate-pulse' : d.status === 'idle' ? 'bg-warning' : 'bg-muted-foreground'
                              )} />
                              <span className="font-semibold text-sm md:text-base truncate">{d.name ?? 'Unnamed'}</span>
                              {d.is_temporary && (
                                <span className="px-1 py-0.5 text-[8px] md:text-[10px] rounded-full bg-purple-500/20 text-purple-400 font-bold shrink-0">TEMP</span>
                              )}
                            </div>
                            <div className="mt-1 md:mt-1.5 text-[10px] md:text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5 md:h-3 md:w-3 shrink-0" />
                              <span className="truncate">{hasFix ? new Date(d.latest!.timestamp).toLocaleString() : 'No location'}</span>
                            </div>
                          </button>
                          <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
                            <Link to={`/devices/${d.id}`} className="p-1 md:p-1.5 rounded-lg hover:bg-primary/10" title="Details">
                              <ExternalLink className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                            </Link>
                            <button onClick={() => handleDeleteDevice(d.id)} className="p-1 md:p-1.5 rounded-lg hover:bg-destructive/10" title="Delete">
                              <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4 text-destructive" />
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

          {/* Driver App Download Card */}
          <Card className="border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-2 md:mb-3">
                <div className="p-1 md:p-1.5 rounded-lg bg-primary/20">
                  <Smartphone className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-xs md:text-sm">Driver App</h3>
              </div>
              <p className="text-[10px] md:text-xs text-muted-foreground mb-2 md:mb-3">
                Get the Rocket Driver app for your drivers
              </p>
              <div className="flex gap-2">
                <a href={APK_DOWNLOAD_URL} download className="flex-1">
                  <Button variant="hero" size="sm" className="w-full h-8 md:h-9 text-xs md:text-sm">
                    <Download className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                    Download
                  </Button>
                </a>
                <ShareAppButton variant="outline" size="sm" className="h-8 md:h-9 text-xs md:text-sm" />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border">
            <CardContent className="p-3 md:p-4 space-y-2">
              <h3 className="font-heading font-semibold text-xs md:text-sm mb-2">Quick Actions</h3>
              <Link to="/temp-tracking" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start h-8 md:h-9 text-xs md:text-sm">
                  <Link2 className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                  Temp Tracking Links
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="w-full justify-start h-8 md:h-9 text-xs md:text-sm text-destructive hover:bg-destructive/10" onClick={handleDeleteTempHistory}>
                <Trash2 className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2" />
                Clear Temp History
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <TempTrackingManager />
      <GeofenceAlerts />

      <Link to="/devices/new" className="lg:hidden fixed bottom-4 right-4 md:bottom-6 md:right-6 z-20 safe-bottom">
        <Button variant="default" size="icon" className="rounded-xl h-12 w-12 md:h-14 md:w-14 shadow-xl">
          <Plus className="h-5 w-5 md:h-6 md:w-6" />
        </Button>
      </Link>
    </div>
  );
}
