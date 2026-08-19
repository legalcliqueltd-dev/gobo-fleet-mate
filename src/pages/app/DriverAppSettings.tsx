import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useAppRole } from '@/contexts/AppRoleContext';
import { detectNativePlatform } from '@/utils/platformDetection';
import { supabase } from '@/integrations/supabase/client';
import { trackingService } from '@/services/trackingService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User, Battery, MapPin, Unlink, Power, AlertTriangle, Palette, Trash2, Shield, FileText, GraduationCap, Repeat } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import DriverOnboarding from '@/components/driver/DriverOnboarding';
import ThemeToggle from '@/components/ThemeToggle';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function DriverAppSettings() {
  const { session, disconnect } = useDriverSession();
  const { clearRole } = useAppRole();
  const navigate = useNavigate();
  const isNativeApp = detectNativePlatform();
  const [disconnecting, setDisconnecting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  
  // Duty status - defaults to true
  const [onDuty, setOnDuty] = useState(() => {
    const stored = localStorage.getItem('driverOnDuty');
    return stored === null ? true : stored === 'true';
  });
  
  // Settings state (stored in localStorage for persistence)
  const [batterySaving, setBatterySaving] = useState(
    localStorage.getItem('batterySavingMode') === 'true'
  );
  const [highAccuracy, setHighAccuracy] = useState(
    localStorage.getItem('highAccuracyMode') !== 'false'
  );

  const handleDutyChange = (checked: boolean) => {
    if (checked) {
      setOnDuty(true);
      localStorage.setItem('driverOnDuty', 'true');
      if (session?.driverId && session?.adminCode) {
        trackingService.start(session.driverId, session.adminCode).catch(console.error);
      }
      toast.success('Tracking enabled - you are now on duty');
    }
  };

  const confirmTurnOffDuty = () => {
    setOnDuty(false);
    localStorage.setItem('driverOnDuty', 'false');
    trackingService.stop().catch(console.error);
    toast.warning('Tracking disabled - your location is no longer being shared');
  };

  const handleBatterySavingChange = (checked: boolean) => {
    setBatterySaving(checked);
    localStorage.setItem('batterySavingMode', String(checked));
    toast.success(checked ? 'Battery saving mode enabled' : 'Battery saving mode disabled');
  };

  const handleHighAccuracyChange = (checked: boolean) => {
    setHighAccuracy(checked);
    localStorage.setItem('highAccuracyMode', String(checked));
    toast.success(checked ? 'High accuracy enabled' : 'High accuracy disabled');
  };

  const handleDeleteAccount = async () => {
    if (!session?.driverId || !session?.adminCode) {
      toast.error('Not connected. Nothing to delete.');
      return;
    }
    setDeleting(true);
    try {
      await trackingService.stop().catch(() => {});

      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'delete-driver',
          driverId: session.driverId,
          adminCode: session.adminCode,
        },
      });

      if (error || !data?.success) {
        const message = (error as { message?: string } | null)?.message
          || (data as { error?: string } | null)?.error
          || 'Failed to delete account';
        toast.error(message);
        return;
      }

      // Clear all local app state
      try {
        localStorage.removeItem('driverOnDuty');
        localStorage.removeItem('driver_location_trail');
        localStorage.removeItem('trail_last_sync_ts');
        localStorage.removeItem('batterySavingMode');
        localStorage.removeItem('highAccuracyMode');
      } catch { /* ignore */ }

      disconnect();
      toast.success('Your driver profile and history have been deleted.');
      navigate('/app/connect', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete account';
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      // Stop persistent tracking immediately
      await trackingService.stop().catch(() => {});

      // Call the edge function to update status
      await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'disconnect',
          driverId: session?.driverId,
        },
      });

      // Clear local session
      disconnect();
      toast.success('Disconnected from fleet');
      navigate('/app/connect');
    } catch (err: any) {
      console.error('Disconnect error:', err);
      // Still disconnect locally even if server call fails
      disconnect();
      toast.success('Disconnected from fleet');
      navigate('/app/connect');
    } finally {
      setDisconnecting(false);
    }
  };

  if (showTutorial) {
    return <DriverOnboarding onComplete={() => setShowTutorial(false)} />;
  }

  return (
    <DriverAppLayout>
      <div className="p-4 space-y-6">
        <div>
          <p className="eyebrow mb-1">Your app</p>
          <h1 className="font-heading text-2xl font-bold">Settings</h1>
        </div>

        {/* Tutorial replay */}
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <GraduationCap className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="font-semibold leading-tight">App tutorial</p>
                <p className="text-xs text-muted-foreground">A quick tour of every button</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowTutorial(true)}>
              View
            </Button>
          </CardContent>
        </Card>

        {/* Mode switch — native only; on the website the manager dashboard
            is simply another page, so a mode picker would make no sense. */}
        {isNativeApp && (
        <Card>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                <Repeat className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="font-semibold leading-tight">Switch mode</p>
                <p className="text-xs text-muted-foreground">Use this device as a manager</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                clearRole();
                navigate('/app/role', { replace: true });
              }}
            >
              Switch
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Profile Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Driver Name</p>
              <p className="font-medium">{session?.driverName || 'Unknown'}</p>
              <p className="text-sm text-muted-foreground mt-3">Admin Code</p>
              <p className="font-mono text-sm">{session?.adminCode || 'Not connected'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Tracking Control - Moved from Dashboard */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Power className="h-5 w-5" />
              Tracking Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="on-duty" className="text-base font-medium">On Duty</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, your location is shared with your fleet manager
                </p>
              </div>
              {onDuty ? (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Switch
                      id="on-duty"
                      checked={onDuty}
                      className="data-[state=checked]:bg-success"
                    />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-warning" />
                        Disable Location Tracking?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Your fleet manager will no longer be able to see your location. 
                        This may affect your job assignments and emergency response capabilities.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep Tracking On</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={confirmTurnOffDuty}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        Turn Off Tracking
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              ) : (
                <Switch
                  id="on-duty"
                  checked={onDuty}
                  onCheckedChange={handleDutyChange}
                />
              )}
            </div>

            {!onDuty && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-xs text-warning">
                  Location tracking is disabled. Your fleet manager cannot see your position.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Location Settings */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="high-accuracy">High Accuracy</Label>
                <p className="text-xs text-muted-foreground">
                  Uses GPS for more precise tracking
                </p>
              </div>
              <Switch
                id="high-accuracy"
                checked={highAccuracy}
                onCheckedChange={handleHighAccuracyChange}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="battery-saving" className="flex items-center gap-2">
                  <Battery className="h-4 w-4" />
                  Battery Saving
                </Label>
                <p className="text-xs text-muted-foreground">
                  Reduces update frequency to save battery
                </p>
              </div>
              <Switch
                id="battery-saving"
                checked={batterySaving}
                onCheckedChange={handleBatterySavingChange}
              />
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Appearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Theme</Label>
                <p className="text-xs text-muted-foreground">Choose light, dark, or system theme</p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* Connection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Unlink className="h-5 w-5" />
              Connection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full" disabled={disconnecting}>
                  {disconnecting ? 'Disconnecting...' : 'Disconnect from Fleet'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect from fleet?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will need to enter your name and connection code again to reconnect. Your location will stop being shared.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDisconnect}>
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Delete Account */}
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete My Account
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete your driver profile, location history, and submitted SOS or delivery
              evidence. This cannot be undone.
            </p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full" disabled={deleting}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleting ? 'Deleting...' : 'Delete My Account'}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Your driver profile, location history, and any photos or videos you have submitted
                    will be permanently removed. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Yes, delete everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>

        {/* Legal links */}
        <div className="flex items-center justify-center gap-4 text-xs">
          <Link to="/privacy" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <Shield className="h-3 w-3" /> Privacy Policy
          </Link>
          <Link to="/terms" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
            <FileText className="h-3 w-3" /> Terms of Service
          </Link>
        </div>

        {/* App Info */}
        <div className="pt-4 text-center font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          <p>FleetTrackMate Driver</p>
          <p className="mt-0.5">v1.0.0</p>
        </div>
      </div>
    </DriverAppLayout>
  );
}
