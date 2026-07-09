import { useMemo, useState, useCallback, useEffect } from 'react';
import { useDeviceLocations } from '@/hooks/useDeviceLocations';
import { useDriverLocations, DriverLocation } from '@/hooks/useDriverLocations';
import LiveDriverMap from '@/components/map/LiveDriverMap';
import DriversList from '@/components/DriversList';
import GeofenceAlerts from '@/components/GeofenceAlerts';
import PaymentWall from '@/components/PaymentWall';
import LockedFeature from '@/components/LockedFeature';
import { Clock, Plus, TrendingUp, Car, Users, Activity, Trash2, Link2, Download, Smartphone, Timer, Copy, Check, CreditCard, Pause, Play, AlertTriangle, Lock } from 'lucide-react';

import { ShareAppButton } from '@/components/ShareAppButton';
import { ShareCodeButton } from '@/components/ShareCodeButton';
import ConfirmDialog from '@/components/ConfirmDialog';
import clsx from 'clsx';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useRefreshOnVisible } from '@/hooks/useRefreshOnVisible';

const APK_DOWNLOAD_URL = "https://fleettrackmate.com/downloads/FleetTrackMate.apk";
export default function Dashboard() {
  const { items, setItems, markers, loading, error } = useDeviceLocations();
  const { drivers } = useDriverLocations();
  const { subscription, hasFullAccess, refreshSubscription } = useAuth();

  // Refresh subscription state when tab regains focus (devices/drivers already auto-refresh)
  useRefreshOnVisible(() => { refreshSubscription(); });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  // Handle payment success callback
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const provider = searchParams.get('provider');
    const plan = searchParams.get('plan');
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    
    if (paymentStatus === 'success') {
      if (provider === 'paystack' && reference) {
        // Verify Paystack payment and activate subscription
        const verifyPaystack = async () => {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData.session?.access_token;
          
          const { data, error } = await supabase.functions.invoke('verify-paystack-payment', {
            body: { reference, plan },
            headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          });
          
          if (error) {
            console.error('Paystack verification error:', error);
            toast.error('Payment received but activation failed. Please contact support.');
          } else {
            toast.success(`Payment successful! Welcome to FleetTrackMate ${plan === 'pro' ? 'Pro' : 'Basic'}.`);
          }
          refreshSubscription();
        };
        verifyPaystack();
      } else {
        // Stripe payment - webhook handles activation, just refresh status
        toast.success('Payment successful! Your subscription is being activated...');
        // Retry subscription check a few times to allow webhook to process
        const retryRefresh = async () => {
          for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 3000));
            await refreshSubscription();
          }
        };
        retryRefresh();
      }
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

  // Convert device markers for LiveDriverMap (exclude paused devices)
  const deviceMarkers = useMemo(() => {
    return markers
      .filter(m => {
        const device = items.find(d => d.id === m.device_id);
        return !device?.is_paused;
      })
      .map(m => ({
        device_id: m.device_id,
        name: m.name || 'Device',
        status: (m.status || 'offline') as 'active' | 'idle' | 'offline',
        latitude: m.latitude,
        longitude: m.longitude,
        speed: m.speed || null,
        timestamp: m.timestamp || null,
      }));
  }, [markers, items]);

  const handleDriverSelect = useCallback((driver: DriverLocation) => {
    setSelectedDriverId(driver.driver_id);
    setSelectedId(null);
  }, []);

  const handleLiveDriverSelect = useCallback((driverId: string) => {
    setSelectedDriverId(driverId);
    setSelectedId(null);
  }, []);

  const [confirmAction, setConfirmAction] = useState<
    | { kind: 'delete-device'; deviceId: string; deviceName: string }
    | { kind: 'clear-temp-history' }
    | null
  >(null);

  const handleDeleteDevice = (deviceId: string) => {
    const device = items.find(d => d.id === deviceId);
    setConfirmAction({ kind: 'delete-device', deviceId, deviceName: device?.name || 'this device' });
  };

  const performDeleteDevice = async (deviceId: string) => {
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

  const handleDeleteTempHistory = () => setConfirmAction({ kind: 'clear-temp-history' });

  const performDeleteTempHistory = async () => {
    try {
      const { error } = await supabase.from('temp_track_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw error;
      toast.success('Temporary tracking history cleared');
    } catch (err) {
      console.error('Error clearing temp history:', err);
      toast.error('Failed to clear temporary history');
    }
  };

  const handleTogglePause = async (deviceId: string, currentlyPaused: boolean) => {
    const newPaused = !currentlyPaused;
    // Optimistic local update
    setItems(prev => prev.map(d => d.id === deviceId ? { ...d, is_paused: newPaused } : d));
    try {
      const { error } = await supabase
        .from('devices')
        .update({ is_paused: newPaused })
        .eq('id', deviceId);
      if (error) {
        // Revert on failure
        setItems(prev => prev.map(d => d.id === deviceId ? { ...d, is_paused: currentlyPaused } : d));
        throw error;
      }
      toast.success(currentlyPaused ? 'Device resumed' : 'Device paused');
    } catch (err) {
      console.error('Error toggling pause:', err);
      toast.error('Failed to update device');
    }
  };

  const activeDevices = items.filter(d => d.status === 'active').length;
  const activeDrivers = drivers.filter(d => 
    d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 15 * 60 * 1000
  ).length;

  // Device limit logic
  const isBasic = subscription.status === 'active' && subscription.plan === 'basic';
  const isPro = subscription.status === 'active' && subscription.plan === 'pro';
  const isTrial = subscription.status === 'trial';
  const deviceLimit = isPro ? Infinity : 2;
  const activeNonPausedDevices = items.filter(d => !d.is_paused).length;
  const isOverLimit = activeNonPausedDevices > deviceLimit;
  const excessCount = Math.max(0, activeNonPausedDevices - deviceLimit);

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
    <div className="relative space-y-3 md:space-y-4">
      {/* Expired Banner */}
      {subscription.status === 'expired' && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-destructive/50 text-destructive bg-destructive/10">
                  Trial Expired
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Subscribe to unlock all admin features. Driver app still works free.
                </span>
              </div>
              <Button variant="hero" size="sm" className="h-7 text-xs" onClick={() => setShowUpgradeModal(true)}>
                Subscribe Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
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

      {/* Over-Limit Banner */}
      {isOverLimit && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium text-destructive">
                  Your plan allows {deviceLimit} device{deviceLimit !== 1 ? 's' : ''}. You have {activeNonPausedDevices} active. Please pause {excessCount} device{excessCount !== 1 ? 's' : ''} to continue.
                </span>
              </div>
              <Button variant="hero" size="sm" className="h-7 text-xs" onClick={() => setShowUpgradeModal(true)}>
                Upgrade to Pro
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* First-run guide: shown until the first device exists */}
      {!loading && items.length === 0 && (
        <Card className="border-primary/30 bg-accent/50">
          <CardContent className="p-4 md:p-5">
            <h2 className="mb-3 font-heading text-lg font-bold">Get your first driver on the map</h2>
            <ol className="grid gap-3 md:grid-cols-3">
              {[
                { n: '01', t: 'Add a device', d: 'Create a device for the vehicle — you get a connection code.' },
                { n: '02', t: 'Share the code', d: 'Send it to your driver by WhatsApp, SMS or email with one tap.' },
                { n: '03', t: 'Watch them live', d: 'The driver enters the code in the app and appears on this map.' },
              ].map((s) => (
                <li key={s.n} className="flex items-start gap-3">
                  <span className="font-mono text-sm font-semibold text-primary">{s.n}</span>
                  <div>
                    <p className="font-semibold leading-tight">{s.t}</p>
                    <p className="text-sm text-muted-foreground">{s.d}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link to="/devices/new" className="mt-4 inline-block">
              <Button variant="hero">
                <Plus className="mr-1.5 h-4 w-4" /> Add your first device
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {[
          { icon: Car, tint: 'text-primary bg-primary/15', value: items.length, label: 'Devices' },
          { icon: Users, tint: 'text-success bg-success/15', value: activeDrivers, label: 'Drivers' },
          { icon: Activity, tint: 'text-warning bg-warning/15', value: activeDevices, label: 'Online' },
        ].map(({ icon: Icon, tint, value, label }) => (
          <Card key={label} className="border border-border">
            <CardContent className="p-3">
              <div className="flex items-center gap-2.5">
                <div className={clsx('shrink-0 rounded-lg p-2', tint)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="telemetry text-xl font-semibold leading-none">{value}</p>
                  <p className="mt-0.5 truncate font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Content - Map on Top */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] gap-2 md:gap-3">
        <section className="order-1 min-h-[45vh] md:min-h-[50vh] lg:min-h-[65vh] relative">
          <div className={isOverLimit ? 'blur-md pointer-events-none h-full' : 'h-full'}>
            <LiveDriverMap
              selectedDriverId={selectedDriverId}
              onDriverSelect={handleLiveDriverSelect}
              showDevices={true}
              devices={deviceMarkers}
            />
          </div>
          {isOverLimit && !showUpgradeModal && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/30 backdrop-blur-sm rounded-lg">
              <div className="bg-card border border-border rounded-xl p-6 shadow-lg text-center max-w-sm mx-4">
                <div className="p-3 rounded-full bg-destructive/10 w-fit mx-auto mb-3">
                  <Lock className="h-6 w-6 text-destructive" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">Map Locked</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Pause {activeNonPausedDevices - deviceLimit} device(s) to unlock the map, or upgrade your plan.
                </p>
                <Button variant="default" onClick={() => setShowUpgradeModal(true)} className="w-full">
                  <CreditCard className="h-4 w-4 mr-1" /> Upgrade to Pro
                </Button>
              </div>
            </div>
          )}
        </section>

        <aside className="order-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-2 md:gap-2">
          {/* Devices */}
          <Card className="border border-border">
            <CardHeader className="p-3 pb-2">
              <div className="flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-heading text-sm font-semibold">
                  <div className="rounded-md bg-primary/15 p-1.5">
                    <Car className="h-3.5 w-3.5 text-primary" />
                  </div>
                  Devices
                </h3>
                <Link to="/devices/new">
                  <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Add
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-3 pt-0">
              {loading && (
                <div className="flex items-center justify-center py-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                </div>
              )}
              {error && <div className="text-xs text-destructive">{error}</div>}
              {!loading && items.length === 0 && (
                <div className="py-3 text-center">
                  <Car className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">No devices yet.</p>
                  <Link to="/devices/new" className="text-xs text-primary hover:underline">Add device →</Link>
                </div>
              )}
              <ul className="max-h-[320px] space-y-2 overflow-y-auto">
                {items.map((d) => {
                  const hasFix = !!d.latest;
                  return (
                    <li key={d.id}>
                      <div className={clsx(
                        'rounded-lg border p-2.5 transition-all',
                        d.is_paused
                          ? 'border-muted bg-muted/30 opacity-60'
                          : selectedId === d.id
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-card/50 hover:border-primary/50'
                      )}>
                        {/* Row 1: name + status + housekeeping */}
                        <div className="flex items-center justify-between gap-2">
                          <button onClick={() => setSelectedId(d.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                            <div className={clsx(
                              'h-2 w-2 shrink-0 rounded-full',
                              d.is_paused ? 'bg-muted-foreground' :
                              d.status === 'active' ? 'bg-success animate-pulse' : d.status === 'idle' ? 'bg-warning' : 'bg-muted-foreground'
                            )} />
                            <span className={clsx('truncate text-sm font-semibold', d.is_paused && 'line-through text-muted-foreground')}>{d.name ?? 'Unnamed'}</span>
                            {d.is_paused && (
                              <Badge variant="outline" className="border-muted-foreground/30 px-1.5 py-0 text-[10px] text-muted-foreground">
                                PAUSED
                              </Badge>
                            )}
                            {d.is_temporary && (
                              <Badge variant="outline" className="border-primary/30 px-1.5 py-0 text-[10px] text-primary">TEMP</Badge>
                            )}
                          </button>
                          <div className="flex shrink-0 items-center gap-0.5">
                            <button
                              onClick={() => handleTogglePause(d.id, !!d.is_paused)}
                              className={clsx('rounded-md p-1.5', d.is_paused ? 'hover:bg-success/10' : 'hover:bg-warning/10')}
                              title={d.is_paused ? 'Resume tracking' : 'Pause tracking'}
                            >
                              {d.is_paused ? (
                                <Play className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <Pause className="h-3.5 w-3.5 text-warning" />
                              )}
                            </button>
                            <button onClick={() => handleDeleteDevice(d.id)} className="rounded-md p-1.5 hover:bg-destructive/10" title="Delete device">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </div>
                        </div>

                        {/* Row 2: the connection code — the thing dispatchers share */}
                        {d.connection_code && !d.is_paused && (
                          <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 p-1.5 pl-2.5">
                            <button
                              onClick={() => handleCopyCode(d.connection_code!, d.id)}
                              className="flex min-w-0 items-center gap-1.5 text-left"
                              title="Copy code"
                            >
                              <span className="telemetry truncate text-base font-semibold tracking-[0.2em]">{d.connection_code}</span>
                              {copiedId === d.id ? (
                                <Check className="h-3.5 w-3.5 shrink-0 text-success" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              )}
                            </button>
                            <ShareCodeButton code={d.connection_code} deviceName={d.name ?? undefined} size="sm" className="h-8 shrink-0" />
                          </div>
                        )}

                        {/* Row 3: last fix */}
                        <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className="truncate">{hasFix ? new Date(d.latest!.timestamp).toLocaleString() : 'No location yet'}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <DriversList onDriverSelect={handleDriverSelect} selectedDriverId={selectedDriverId} />

          {/* Everything else in one quiet card */}
          <Card className="border border-border">
            <CardContent className="space-y-4 p-3">
              {/* Driver app */}
              <div>
                <h3 className="mb-2 flex items-center gap-2 font-heading text-sm font-semibold">
                  <Smartphone className="h-4 w-4 text-primary" />
                  Driver app
                </h3>
                <div className="flex gap-2">
                  <a href={APK_DOWNLOAD_URL} download className="flex-1">
                    <Button variant="default" size="sm" className="h-9 w-full text-xs">
                      <Download className="mr-1 h-3.5 w-3.5" />
                      Download
                    </Button>
                  </a>
                  <ShareAppButton variant="outline" size="sm" className="h-9 flex-1 text-xs" />
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Billing */}
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" />
                  <h3 className="font-heading text-sm font-semibold">Billing</h3>
                  {subscription.status === 'active' && subscription.plan && (
                    <Badge variant="outline" className="ml-auto border-success/30 bg-success/10 px-1.5 py-0 text-[10px] text-success">
                      {subscription.plan === 'pro' ? 'Pro' : 'Basic'} active
                    </Badge>
                  )}
                  {subscription.status === 'trial' && (
                    <Badge variant="outline" className="ml-auto border-warning/30 bg-warning/10 px-1.5 py-0 text-[10px] text-warning">
                      Trial
                    </Badge>
                  )}
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  {subscription.status === 'active' && subscription.subscriptionEnd
                    ? `Active until ${new Date(subscription.subscriptionEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    : subscription.status === 'trial'
                      ? `${subscription.trialDaysRemaining} day${subscription.trialDaysRemaining !== 1 ? 's' : ''} left in your free trial`
                      : 'Trial expired — subscribe to continue'}
                </p>
                <Button
                  variant={subscription.status === 'active' ? 'outline' : 'hero'}
                  size="sm"
                  className="h-9 w-full text-xs"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  <CreditCard className="mr-1 h-3.5 w-3.5" />
                  {subscription.status === 'active' ? 'Manage plan' : 'Upgrade now'}
                </Button>
              </div>

              <div className="border-t border-border" />

              {/* Temp tracking */}
              <div className="flex gap-2">
                <Link to="/temp-tracking" className="flex-1">
                  <Button variant="outline" size="sm" className="h-9 w-full justify-start text-xs">
                    <Link2 className="mr-1 h-3.5 w-3.5" />
                    Temp tracking
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-destructive hover:bg-destructive/10"
                  onClick={handleDeleteTempHistory}
                  title="Clear temporary tracking history"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <LockedFeature featureName="Geofence Alerts">
        <GeofenceAlerts />
      </LockedFeature>

      {/* Styled confirmations (replaces window.confirm) */}
      <ConfirmDialog
        open={confirmAction?.kind === 'delete-device'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction?.kind === 'delete-device' ? `Delete ${confirmAction.deviceName}?` : ''}
        description="The device, its location history and trips will be permanently deleted. This cannot be undone."
        confirmLabel="Delete device"
        destructive
        onConfirm={() => {
          if (confirmAction?.kind === 'delete-device') performDeleteDevice(confirmAction.deviceId);
          setConfirmAction(null);
        }}
      />
      <ConfirmDialog
        open={confirmAction?.kind === 'clear-temp-history'}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title="Clear temporary tracking history?"
        description="All temporary tracking sessions will be deleted. Active share links will stop working."
        confirmLabel="Clear history"
        destructive
        onConfirm={() => {
          performDeleteTempHistory();
          setConfirmAction(null);
        }}
      />

      <Link to="/devices/new" className="lg:hidden fixed bottom-4 right-4 md:bottom-6 md:right-6 z-20 safe-bottom">
        <Button variant="default" size="icon" className="rounded-xl h-12 w-12 md:h-14 md:w-14 shadow-xl">
          <Plus className="h-5 w-5 md:h-6 md:w-6" />
        </Button>
      </Link>
    </div>
  );
}
