import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User, Battery, MapPin, Unlink, Power, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
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
  const navigate = useNavigate();
  const [disconnecting, setDisconnecting] = useState(false);
  
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
    // If turning off, this is handled by the AlertDialog
    // If turning on, just do it
    if (checked) {
      setOnDuty(true);
      localStorage.setItem('driverOnDuty', 'true');
      toast.success('Tracking enabled - you are now on duty');
    }
  };

  const confirmTurnOffDuty = () => {
    setOnDuty(false);
    localStorage.setItem('driverOnDuty', 'false');
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

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
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

  return (
    <DriverAppLayout>
      <div className="p-4 space-y-6">
        <h1 className="text-2xl font-bold">Settings</h1>

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

        {/* App Info */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>FleetTrackMate Driver</p>
          <p>Version 1.0.0</p>
        </div>
      </div>
    </DriverAppLayout>
  );
}
