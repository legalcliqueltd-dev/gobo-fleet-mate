import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Bell, Navigation, MapPin, Battery, LogOut, Info, Link2, X, User, Pencil, Check } from 'lucide-react';
import { toast } from 'sonner';
import ThemeToggle from '@/components/ThemeToggle';

export default function DriverSettings() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [onDuty, setOnDuty] = useState(false);
  const [pingInterval, setPingInterval] = useState(30);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [batterySaving, setBatterySaving] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState<{ id: string; name: string } | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [driverName, setDriverName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    loadSettings();
    checkDeviceConnection();
  }, []);

  const checkDeviceConnection = async () => {
    if (!user) return;
    
    setCheckingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: { action: 'get-connection' },
      });

      if (!error && data.connected && data.device) {
        setConnectedDevice(data.device);
        if (data.driverName) {
          setDriverName(data.driverName);
        }
      } else {
        setConnectedDevice(null);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
    } finally {
      setCheckingConnection(false);
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: { action: 'disconnect' },
      });

      if (error) throw error;

      if (data.success) {
        setConnectedDevice(null);
        toast.success('Disconnected from device');
      }
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect');
    }
  };

  const loadSettings = async () => {
    if (!user) return;
    
    // Load user preferences from local storage or database
    const savedOnDuty = localStorage.getItem('driver_on_duty') === 'true';
    const savedInterval = localStorage.getItem('driver_ping_interval');
    const savedNotifications = localStorage.getItem('driver_notifications') !== 'false';
    const savedBatterySaving = localStorage.getItem('driver_battery_saving') !== 'false';
    
    setOnDuty(savedOnDuty);
    setPingInterval(savedInterval ? parseInt(savedInterval) : 30);
    setNotificationsEnabled(savedNotifications);
    setBatterySaving(savedBatterySaving);
  };

  const handleToggleOnDuty = async () => {
    const newStatus = !onDuty;
    setOnDuty(newStatus);
    localStorage.setItem('driver_on_duty', String(newStatus));
    
    if (newStatus) {
      toast.success('Now on duty - background tracking enabled');
    } else {
      toast.success('Off duty - background tracking disabled');
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    
    try {
      // Save to local storage
      localStorage.setItem('driver_ping_interval', String(pingInterval));
      localStorage.setItem('driver_notifications', String(notificationsEnabled));
      localStorage.setItem('driver_battery_saving', String(batterySaving));
      
      // Optionally save to database
      if (user) {
        // Create/update user preferences in profiles or separate table
      }
      
      toast.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
    navigate('/auth/login');
  };

  const requestNotificationPermission = async () => {
    if ('Notification' in window && 'serviceWorker' in navigator) {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        toast.success('Notifications enabled');
        
        // Register push subscription
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY', // Replace with actual key
          });
          
          // Save subscription to database
          await supabase.from('push_subscriptions').insert({
            user_id: user?.id,
            endpoint: subscription.endpoint,
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh') as ArrayBuffer))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth') as ArrayBuffer))),
          });
        } catch (error) {
          console.error('Push subscription error:', error);
        }
      } else {
        setNotificationsEnabled(false);
        toast.error('Notification permission denied');
      }
    } else {
      toast.error('Notifications not supported on this device');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Driver Settings</h1>
        <Button variant="ghost" onClick={() => navigate('/driver/dashboard')}>
          Back to Dashboard
        </Button>
      </div>

      {/* Device Connection */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Link2 className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Device Connection</h2>
              <p className="text-sm text-muted-foreground">
                Link your app to an admin's tracking device
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {checkingConnection ? (
            <div className="p-4 text-center text-muted-foreground">
              Checking connection...
            </div>
          ) : connectedDevice ? (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Connected
                  </span>
                  <span className="inline-flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                </div>
                <p className="text-lg font-semibold mb-1">{connectedDevice.name}</p>
                <p className="text-xs text-muted-foreground">
                  Your location is syncing to this device when on duty
                </p>
              </div>
              
              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="w-full"
              >
                <X className="h-4 w-4 mr-2" />
                Disconnect Device
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <p className="text-sm text-muted-foreground">
                  Not connected to any device
                </p>
              </div>
              
              <Button
                onClick={() => navigate('/driver/connect')}
                className="w-full"
              >
                <Link2 className="h-4 w-4 mr-2" />
                Connect to Device
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Driver Profile */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <User className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Your Profile</h2>
              <p className="text-sm text-muted-foreground">
                How you appear to your admin
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="font-medium">Display Name</Label>
                {editingName ? (
                  <div className="flex items-center gap-2 mt-2">
                    <Input
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      placeholder="Enter your name"
                      className="max-w-[200px]"
                      disabled={savingName}
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (!driverName.trim()) {
                          toast.error('Name cannot be empty');
                          return;
                        }
                        setSavingName(true);
                        try {
                          const { data, error } = await supabase.functions.invoke('connect-driver', {
                            body: { action: 'update-name', name: driverName.trim() },
                          });
                          if (error) throw error;
                          if (data.success) {
                            toast.success('Name updated');
                            setEditingName(false);
                          }
                        } catch (err) {
                          toast.error('Failed to update name');
                        } finally {
                          setSavingName(false);
                        }
                      }}
                      disabled={savingName}
                    >
                      <Check className="h-4 w-4 text-success" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingName(false)}
                      disabled={savingName}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-lg font-semibold mt-1">
                    {driverName || user?.email?.split('@')[0] || 'Not set'}
                  </p>
                )}
              </div>
              {!editingName && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setEditingName(true)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              This name will be visible to your admin on the dashboard
            </p>
          </div>
        </CardContent>
      </Card>

      {/* On Duty Status */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Navigation className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Duty Status</h2>
              <p className="text-sm text-muted-foreground">
                Enable background location tracking
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="on-duty" className="text-lg font-medium">
                {onDuty ? 'On Duty' : 'Off Duty'}
              </Label>
              <p className="text-sm text-muted-foreground">
                {onDuty 
                  ? 'Your location is being tracked and shared' 
                  : 'Location tracking is paused'}
              </p>
            </div>
            <Switch
              id="on-duty"
              checked={onDuty}
              onCheckedChange={handleToggleOnDuty}
              className="scale-125"
            />
          </div>
        </CardContent>
      </Card>

      {/* Location Settings */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <MapPin className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Location Updates</h2>
              <p className="text-sm text-muted-foreground">
                Configure location ping frequency
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base mb-3 block">
              Update Interval: {pingInterval} seconds
            </Label>
            <Slider
              value={[pingInterval]}
              onValueChange={(v) => setPingInterval(v[0])}
              min={10}
              max={120}
              step={10}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Lower values provide more accurate tracking but use more battery
            </p>
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Battery className="h-5 w-5" />
              <div>
                <Label htmlFor="battery-saving" className="font-medium">
                  Battery Saving Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Reduces update frequency when battery is low
                </p>
              </div>
            </div>
            <Switch
              id="battery-saving"
              checked={batterySaving}
              onCheckedChange={setBatterySaving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Notifications</h2>
              <p className="text-sm text-muted-foreground">
                Manage push notifications
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <Label htmlFor="notifications" className="font-medium">
                  Push Notifications
                </Label>
                <p className="text-xs text-muted-foreground">
                  Receive alerts for new tasks and updates
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notificationsEnabled}
                onCheckedChange={(checked) => {
                  if (checked) {
                    requestNotificationPermission();
                  } else {
                    setNotificationsEnabled(false);
                  }
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card variant="glass">
        <CardHeader>
          <div>
            <h2 className="text-xl font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Customize app appearance
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <Label className="font-medium">Theme</Label>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* App Info */}
      <Card variant="glass">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Info className="h-6 w-6 text-primary" />
            <div>
              <h2 className="text-xl font-semibold">App Information</h2>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">User ID</span>
              <span className="font-mono text-xs">{user?.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="text-xs">{user?.email}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          onClick={handleSaveSettings}
          disabled={saving}
          className="flex-1"
          size="lg"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        <Button
          onClick={handleLogout}
          variant="outline"
          size="lg"
          className="flex-1"
        >
          <LogOut className="h-5 w-5 mr-2" />
          Logout
        </Button>
      </div>
    </div>
  );
}
