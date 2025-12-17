import { useState, useEffect, useRef } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  MapPin, 
  Send, 
  Play, 
  Pause, 
  RefreshCw, 
  Battery, 
  Gauge, 
  Navigation,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';

const EDGE_FUNCTION_URL = 'https://invbnyxieoyohahqhbir.supabase.co/functions/v1/connect-driver';

interface Driver {
  driver_id: string;
  driver_name: string;
  admin_code: string;
  status: string;
}

interface LogEntry {
  timestamp: Date;
  action: string;
  success: boolean;
  message: string;
}

const LocationSimulator = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [latitude, setLatitude] = useState<number>(6.5244);
  const [longitude, setLongitude] = useState<number>(3.3792);
  const [speed, setSpeed] = useState<number>(0);
  const [accuracy, setAccuracy] = useState<number>(10);
  const [bearing, setBearing] = useState<number>(0);
  const [batteryLevel, setBatteryLevel] = useState<number>(85);
  const [isBackground, setIsBackground] = useState<boolean>(false);
  const [isAutoSimulating, setIsAutoSimulating] = useState<boolean>(false);
  const [simulationInterval, setSimulationInterval] = useState<number>(15);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [isSending, setIsSending] = useState<boolean>(false);
  
  const simulationRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch drivers on mount
  useEffect(() => {
    fetchDrivers();
  }, [user]);

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
      }
    };
  }, []);

  const fetchDrivers = async () => {
    if (!user) return;
    
    // Get admin codes from devices
    const { data: devices } = await supabase
      .from('devices')
      .select('connection_code')
      .eq('user_id', user.id)
      .not('connection_code', 'is', null);

    if (!devices || devices.length === 0) return;

    const adminCodes = devices.map(d => d.connection_code);
    
    // Get drivers for those admin codes
    const { data: driversData } = await supabase
      .from('drivers')
      .select('*')
      .in('admin_code', adminCodes);

    if (driversData) {
      setDrivers(driversData);
      if (driversData.length > 0 && !selectedDriverId) {
        setSelectedDriverId(driversData[0].driver_id);
      }
    }
  };

  const addLog = (action: string, success: boolean, message: string) => {
    setLogs(prev => [{
      timestamp: new Date(),
      action,
      success,
      message
    }, ...prev].slice(0, 50)); // Keep last 50 logs
  };

  const sendLocationUpdate = async () => {
    if (!selectedDriverId) {
      toast.error('Please select a driver');
      return;
    }

    setIsSending(true);
    
    try {
      const payload = {
        action: 'update-location',
        driverId: selectedDriverId,
        latitude,
        longitude,
        speed,
        accuracy,
        bearing,
        battery_level: batteryLevel,
        is_background: isBackground
      };

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      setLastResponse(data);

      if (data.success) {
        addLog('update-location', true, `Location sent: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
        toast.success('Location update sent');
      } else {
        addLog('update-location', false, data.error || 'Failed');
        toast.error(data.error || 'Failed to send location');
      }
    } catch (error: any) {
      addLog('update-location', false, error.message);
      toast.error('Network error');
    } finally {
      setIsSending(false);
    }
  };

  const sendHeartbeat = async () => {
    if (!selectedDriverId) {
      toast.error('Please select a driver');
      return;
    }

    setIsSending(true);
    
    try {
      const payload = {
        action: 'update-status',
        driverId: selectedDriverId,
        status: 'active',
        battery_level: batteryLevel
      };

      const response = await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      setLastResponse(data);

      if (data.success) {
        addLog('update-status', true, 'Heartbeat sent');
        toast.success('Heartbeat sent');
      } else {
        addLog('update-status', false, data.error || 'Failed');
        toast.error(data.error || 'Failed to send heartbeat');
      }
    } catch (error: any) {
      addLog('update-status', false, error.message);
      toast.error('Network error');
    } finally {
      setIsSending(false);
    }
  };

  const toggleAutoSimulation = () => {
    if (isAutoSimulating) {
      // Stop simulation
      if (simulationRef.current) {
        clearInterval(simulationRef.current);
        simulationRef.current = null;
      }
      setIsAutoSimulating(false);
      toast.info('Auto simulation stopped');
    } else {
      // Start simulation
      if (!selectedDriverId) {
        toast.error('Please select a driver first');
        return;
      }
      
      setIsAutoSimulating(true);
      toast.success(`Auto simulation started (every ${simulationInterval}s)`);
      
      // Send immediately, then at intervals
      sendLocationUpdate();
      
      simulationRef.current = setInterval(() => {
        // Simulate movement - random walk
        setLatitude(prev => prev + (Math.random() - 0.5) * 0.001);
        setLongitude(prev => prev + (Math.random() - 0.5) * 0.001);
        setSpeed(Math.random() * 60);
        setBearing(prev => (prev + Math.random() * 30) % 360);
        setBatteryLevel(prev => Math.max(1, prev - Math.random() * 0.5));
        
        sendLocationUpdate();
      }, simulationInterval * 1000);
    }
  };

  const useCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLatitude(position.coords.latitude);
          setLongitude(position.coords.longitude);
          setAccuracy(position.coords.accuracy);
          if (position.coords.speed) setSpeed(position.coords.speed * 3.6); // m/s to km/h
          if (position.coords.heading) setBearing(position.coords.heading);
          toast.success('Location updated from GPS');
        },
        (error) => {
          toast.error('Could not get location: ' + error.message);
        }
      );
    } else {
      toast.error('Geolocation not supported');
    }
  };

  const selectedDriver = drivers.find(d => d.driver_id === selectedDriverId);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Location Simulator</h1>
            <p className="text-muted-foreground">Test location tracking by simulating driver updates</p>
          </div>
          <Button variant="outline" onClick={fetchDrivers}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Drivers
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Controls */}
          <div className="space-y-6">
            {/* Driver Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Select Driver</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a driver to simulate" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map(driver => (
                      <SelectItem key={driver.driver_id} value={driver.driver_id}>
                        {driver.driver_name} ({driver.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedDriver && (
                  <div className="mt-3 p-3 bg-muted rounded-lg text-sm">
                    <p><strong>ID:</strong> {selectedDriver.driver_id}</p>
                    <p><strong>Admin Code:</strong> {selectedDriver.admin_code}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location Controls */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  Location
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Latitude</Label>
                    <Input 
                      type="number" 
                      step="0.0001"
                      value={latitude} 
                      onChange={(e) => setLatitude(parseFloat(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Longitude</Label>
                    <Input 
                      type="number" 
                      step="0.0001"
                      value={longitude} 
                      onChange={(e) => setLongitude(parseFloat(e.target.value))}
                    />
                  </div>
                </div>
                <Button variant="outline" className="w-full" onClick={useCurrentLocation}>
                  <Navigation className="w-4 h-4 mr-2" />
                  Use My Current Location
                </Button>
              </CardContent>
            </Card>

            {/* Speed & Accuracy */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Gauge className="w-5 h-5" />
                  Speed & Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Speed</Label>
                    <span className="text-sm text-muted-foreground">{speed.toFixed(1)} km/h</span>
                  </div>
                  <Slider 
                    value={[speed]} 
                    onValueChange={([v]) => setSpeed(v)}
                    max={120}
                    step={1}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Accuracy</Label>
                    <span className="text-sm text-muted-foreground">{accuracy.toFixed(0)} m</span>
                  </div>
                  <Slider 
                    value={[accuracy]} 
                    onValueChange={([v]) => setAccuracy(v)}
                    max={100}
                    step={1}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Bearing</Label>
                    <span className="text-sm text-muted-foreground">{bearing.toFixed(0)}°</span>
                  </div>
                  <Slider 
                    value={[bearing]} 
                    onValueChange={([v]) => setBearing(v)}
                    max={360}
                    step={1}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Device Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Battery className="w-5 h-5" />
                  Device Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Battery Level</Label>
                    <span className="text-sm text-muted-foreground">{batteryLevel.toFixed(0)}%</span>
                  </div>
                  <Slider 
                    value={[batteryLevel]} 
                    onValueChange={([v]) => setBatteryLevel(v)}
                    max={100}
                    step={1}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Background Mode</Label>
                  <Switch checked={isBackground} onCheckedChange={setIsBackground} />
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    onClick={sendLocationUpdate} 
                    disabled={isSending || !selectedDriverId}
                    className="w-full"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Send Location
                  </Button>
                  <Button 
                    variant="secondary"
                    onClick={sendHeartbeat} 
                    disabled={isSending || !selectedDriverId}
                    className="w-full"
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Send Heartbeat
                  </Button>
                </div>
                
                <div className="border-t pt-3">
                  <div className="flex items-center gap-3 mb-3">
                    <Label>Auto-send every</Label>
                    <Input 
                      type="number" 
                      value={simulationInterval}
                      onChange={(e) => setSimulationInterval(parseInt(e.target.value) || 15)}
                      className="w-20"
                      min={5}
                      max={60}
                    />
                    <span className="text-sm text-muted-foreground">seconds</span>
                  </div>
                  <Button 
                    onClick={toggleAutoSimulation}
                    variant={isAutoSimulating ? "destructive" : "default"}
                    className="w-full"
                    disabled={!selectedDriverId}
                  >
                    {isAutoSimulating ? (
                      <>
                        <Pause className="w-4 h-4 mr-2" />
                        Stop Auto Simulation
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Start Auto Simulation
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Response & Logs */}
          <div className="space-y-6">
            {/* Last Response */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Last Response</CardTitle>
                <CardDescription>Response from the connect-driver edge function</CardDescription>
              </CardHeader>
              <CardContent>
                {lastResponse ? (
                  <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-48">
                    {JSON.stringify(lastResponse, null, 2)}
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-sm">No response yet. Send a location update to see the response.</p>
                )}
              </CardContent>
            </Card>

            {/* Activity Log */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Activity Log</CardTitle>
                <CardDescription>Recent simulation activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-auto">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No activity yet.</p>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm p-2 bg-muted/50 rounded">
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {log.action}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {log.timestamp.toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-muted-foreground truncate">{log.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Presets */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Presets</CardTitle>
                <CardDescription>Common locations for testing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { setLatitude(6.5244); setLongitude(3.3792); }}
                  >
                    Lagos
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { setLatitude(9.0579); setLongitude(7.4951); }}
                  >
                    Abuja
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { setLatitude(4.8156); setLongitude(7.0498); }}
                  >
                    Port Harcourt
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => { setLatitude(7.3776); setLongitude(3.9470); }}
                  >
                    Ibadan
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default LocationSimulator;
