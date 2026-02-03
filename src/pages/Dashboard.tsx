import { useMemo, useState, useCallback, useEffect } from 'react';
import { useDeviceLocations } from '../hooks/useDeviceLocations';
import { useDriverLocations, DriverLocation } from '../hooks/useDriverLocations';
import LiveDriverMap from '../components/map/LiveDriverMap';
import DriversList from '../components/DriversList';
import GeofenceAlerts from '../components/GeofenceAlerts';
import TempTrackingManager from '../components/TempTrackingManager';
import PaymentWall from '../components/PaymentWall';
import { Clock, Plus, TrendingUp, Car, Users, Activity, Trash2, Link2, Download, Smartphone, Timer, Copy, Check } from 'lucide-react';
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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

  const handleCopyCode = async (code: string, deviceId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(deviceId);
      toast.success('Code copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };


  return (
    <div className="space-y-3 md:space-y-4">
      {/* Upgrade Modal - shown when user clicks Upgrade Now during trial */}
      {showUpgradeModal && (
        <PaymentWall onDismiss={() => setShowUpgradeModal(false)} />
      )}

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
              <Button 
                variant="hero" 
                size="sm" 
                className="h-7 text-xs"
                onClick={() => setShowUpgradeModal(true)}
              >
                Upgrade Now
              </Button>
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

      {/* Stats Banner - Compact */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <CardContent className="p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/20 shrink-0">
                <Car className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold">{items.length}</p>
                <p className="text-[10px] text-muted-foreground truncate">Devices</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
          <CardContent className="p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-success/20 shrink-0">
                <Users className="h-3.5 w-3.5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold">{activeDrivers}</p>
                <p className="text-[10px] text-muted-foreground truncate">Drivers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20">
          <CardContent className="p-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-warning/20 shrink-0">
                <Activity className="h-3.5 w-3.5 text-warning" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold">{activeDevices}</p>
                <p className="text-[10px] text-muted-foreground truncate">Online</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Link to="/analytics" className="block">
          <Card className="bg-gradient-to-br from-fleet-blue/10 to-fleet-blue/5 border border-fleet-blue/20 hover:border-fleet-blue/40 transition-all h-full">
            <CardContent className="p-2">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-fleet-blue/20 shrink-0">
                  <TrendingUp className="h-3.5 w-3.5 text-fleet-blue" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Analytics</p>
                  <p className="text-[10px] text-muted-foreground truncate">Reports →</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Main Content - Map on Top */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_340px] gap-2 md:gap-3">
        <section className="order-1 min-h-[45vh] md:min-h-[50vh] lg:min-h-[65vh]">
          <LiveDriverMap
            selectedDriverId={selectedDriverId}
            onDriverSelect={handleLiveDriverSelect}
            showDevices={true}
            devices={deviceMarkers}
          />
        </section>

        <aside className="order-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2 md:gap-2">
          {/* Devices Card - Compact */}
          <Card className="border border-border">
            <CardHeader className="p-1.5 md:p-2 pb-1">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold flex items-center gap-1.5 text-xs md:text-sm">
                  <div className="p-1 rounded-md bg-primary/20">
                    <Car className="h-3 w-3 text-primary" />
                  </div>
                  Devices
                </h3>
                <Link to="/devices/new">
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2">
                    <Plus className="h-3 w-3 mr-0.5" /> Add
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-1.5 md:p-2 pt-0">
              {loading && (
                <div className="flex items-center justify-center py-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              )}
              {error && <div className="text-[10px] text-destructive">{error}</div>}
              {!loading && items.length === 0 && (
                <div className="text-center py-2">
                  <Car className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">No devices yet.</p>
                  <Link to="/devices/new" className="text-[10px] text-primary hover:underline">Add device →</Link>
                </div>
              )}
              <ul className="space-y-1 max-h-[180px] md:max-h-[220px] overflow-y-auto">
                {items.map((d) => {
                  const hasFix = !!d.latest;
                  return (
                    <li key={d.id}>
                      <div className={clsx(
                        'rounded-md border p-1.5 transition-all hover:border-primary/50 hover:bg-primary/5',
                        selectedId === d.id ? 'border-primary bg-primary/10' : 'border-border bg-card/50'
                      )}>
                        {/* Row 1: Name + Code + Actions */}
                        <div className="flex items-center justify-between gap-1">
                          <button onClick={() => setSelectedId(d.id)} className="text-left flex-1 min-w-0 flex items-center gap-1.5">
                            <div className={clsx(
                              'h-1.5 w-1.5 rounded-full shrink-0',
                              d.status === 'active' ? 'bg-success animate-pulse' : d.status === 'idle' ? 'bg-warning' : 'bg-muted-foreground'
                            )} />
                            <span className="font-medium text-[11px] truncate">{d.name ?? 'Unnamed'}</span>
                          </button>
                          <div className="flex items-center gap-0.5 shrink-0">
                            {d.connection_code && (
                              <>
                                <span className="text-[9px] font-mono text-muted-foreground">{d.connection_code}</span>
                                <button
                                  onClick={() => handleCopyCode(d.connection_code!, d.id)}
                                  className="p-0.5 rounded hover:bg-primary/10"
                                  title="Copy"
                                >
                                  {copiedId === d.id ? (
                                    <Check className="h-2.5 w-2.5 text-success" />
                                  ) : (
                                    <Copy className="h-2.5 w-2.5 text-muted-foreground" />
                                  )}
                                </button>
                              </>
                            )}
                            <button onClick={() => handleDeleteDevice(d.id)} className="p-0.5 rounded hover:bg-destructive/10" title="Delete">
                              <Trash2 className="h-2.5 w-2.5 text-destructive" />
                            </button>
                          </div>
                        </div>
                        {/* Row 2: Timestamp + TEMP badge */}
                        <div className="flex items-center justify-between mt-0.5">
                          <div className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-2 w-2" />
                            <span className="truncate">{hasFix ? new Date(d.latest!.timestamp).toLocaleString() : 'No location'}</span>
                          </div>
                          {d.is_temporary && (
                            <span className="px-1 py-0.5 text-[7px] rounded bg-purple-500/20 text-purple-400 font-bold">TEMP</span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <DriversList onDriverSelect={handleDriverSelect} selectedDriverId={selectedDriverId} />

          {/* Driver App Download Card - Compact */}
          <Card className="border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="p-1.5 md:p-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="p-1 rounded-md bg-primary/20">
                  <Smartphone className="h-3 w-3 text-primary" />
                </div>
                <h3 className="font-heading font-semibold text-[11px]">Driver App</h3>
              </div>
              <div className="flex gap-1.5">
                <a href={APK_DOWNLOAD_URL} download className="flex-1">
                  <Button variant="hero" size="sm" className="w-full h-6 text-[10px]">
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                </a>
                <ShareAppButton variant="outline" size="sm" className="h-6 text-[10px] px-2" />
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions - Compact */}
          <Card className="border border-border">
            <CardContent className="p-1.5 md:p-2 space-y-1">
              <h3 className="font-heading font-semibold text-[11px] mb-1">Quick Actions</h3>
              <Link to="/temp-tracking" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start h-6 text-[10px]">
                  <Link2 className="h-3 w-3 mr-1" />
                  Temp Tracking
                </Button>
              </Link>
              <Button variant="outline" size="sm" className="w-full justify-start h-6 text-[10px] text-destructive hover:bg-destructive/10" onClick={handleDeleteTempHistory}>
                <Trash2 className="h-3 w-3 mr-1" />
                Clear History
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
