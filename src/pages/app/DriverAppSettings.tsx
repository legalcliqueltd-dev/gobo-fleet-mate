import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { User, LogOut, Battery, MapPin, Unlink } from 'lucide-react';
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
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [disconnecting, setDisconnecting] = useState(false);
  
  // Settings state (stored in localStorage for persistence)
  const [batterySaving, setBatterySaving] = useState(
    localStorage.getItem('batterySavingMode') === 'true'
  );
  const [highAccuracy, setHighAccuracy] = useState(
    localStorage.getItem('highAccuracyMode') !== 'false'
  );

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
      const { error } = await supabase.functions.invoke('connect-driver', {
        body: { action: 'disconnect' },
      });

      if (error) throw error;

      toast.success('Disconnected from fleet');
      navigate('/app/connect');
    } catch (err: any) {
      console.error('Disconnect error:', err);
      toast.error('Failed to disconnect');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/app/login');
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
              <p className="text-sm text-muted-foreground">Signed in as</p>
              <p className="font-medium">{user?.email}</p>
            </div>
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
                    You will need to enter a new connection code to reconnect. Your location will stop being shared.
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

        {/* Sign Out */}
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>

        {/* App Info */}
        <div className="text-center text-xs text-muted-foreground pt-4">
          <p>FleetTrackMate Driver</p>
          <p>Version 1.0.0</p>
        </div>
      </div>
    </DriverAppLayout>
  );
}
