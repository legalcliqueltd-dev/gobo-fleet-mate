import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ArrowLeft, MapPin, Clock, Navigation, Trash2, Unlink, 
  User, Activity, Calendar, Signal, AlertTriangle, Pencil, Check, X
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import DriverLocationMap from '@/components/map/DriverLocationMap';

type DriverDetail = {
  driver_id: string;
  driver_name: string | null;
  admin_code: string;
  status: string | null;
  last_seen_at: string | null;
  connected_at: string | null;
  device_info: Record<string, unknown> | null;
};

type LocationHistory = {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  recorded_at: string | null;
};

type CurrentLocation = {
  latitude: number;
  longitude: number;
  speed: number | null;
  accuracy: number | null;
  updated_at: string | null;
};

export default function DriverDetails() {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  
  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!driverId || !user) return;

    const fetchDriver = async () => {
      try {
        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('driver_id', driverId)
          .single();

        if (driverError) throw driverError;
        setDriver(driverData as DriverDetail);
        setEditedName(driverData.driver_name || '');

        // Fetch current location from driver_locations
        const { data: currentLocData } = await supabase
          .from('driver_locations')
          .select('latitude, longitude, speed, accuracy, updated_at')
          .eq('driver_id', driverId)
          .single();

        if (currentLocData) {
          setCurrentLocation(currentLocData as CurrentLocation);
        }

        // Fetch location history from driver_location_history table
        const { data: historyData } = await supabase
          .from('driver_location_history')
          .select('latitude, longitude, speed, accuracy, recorded_at')
          .eq('driver_id', driverId)
          .order('recorded_at', { ascending: false })
          .limit(100);

        if (historyData) {
          setLocationHistory(historyData as LocationHistory[]);
        }
      } catch (err) {
        console.error('Error fetching driver:', err);
        toast.error('Failed to load driver details');
      } finally {
        setLoading(false);
      }
    };

    fetchDriver();
  }, [driverId, user]);

  const handleSaveName = async () => {
    if (!driver) return;
    setSavingName(true);

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ driver_name: editedName.trim() || null })
        .eq('driver_id', driver.driver_id);

      if (error) throw error;

      setDriver({ ...driver, driver_name: editedName.trim() || null });
      setIsEditingName(false);
      toast.success('Driver name updated');
    } catch (err) {
      console.error('Error updating name:', err);
      toast.error('Failed to update name');
    } finally {
      setSavingName(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedName(driver?.driver_name || '');
    setIsEditingName(false);
  };

  const handleDisconnect = async () => {
    if (!driver) return;
    setDisconnecting(true);

    try {
      const { error } = await supabase
        .from('drivers')
        .update({ status: 'disconnected' })
        .eq('driver_id', driver.driver_id);

      if (error) throw error;
      toast.success('Driver disconnected successfully');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error disconnecting driver:', err);
      toast.error('Failed to disconnect driver');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleDelete = async () => {
    if (!driver) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to delete ${driver.driver_name || 'this driver'}? This will also delete all their location history.`
    );
    
    if (!confirmed) return;
    setDeleting(true);

    try {
      await supabase.from('driver_locations').delete().eq('driver_id', driver.driver_id);
      const { error } = await supabase.from('drivers').delete().eq('driver_id', driver.driver_id);

      if (error) throw error;
      toast.success('Driver deleted successfully');
      navigate('/dashboard');
    } catch (err) {
      console.error('Error deleting driver:', err);
      toast.error('Failed to delete driver');
    } finally {
      setDeleting(false);
    }
  };

  const isOnline = driver?.last_seen_at 
    ? Date.now() - new Date(driver.last_seen_at).getTime() < 15 * 60 * 1000 
    : false;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 text-warning mx-auto mb-4" />
        <h2 className="text-xl font-semibold mb-2">Driver not found</h2>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  placeholder="Enter driver name"
                  className="max-w-[250px] h-9"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveName} disabled={savingName} className="h-9">
                  <Check className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-9">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-heading font-bold flex items-center gap-3">
                  <div className={clsx(
                    'h-3 w-3 rounded-full',
                    isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground'
                  )} />
                  {driver.driver_name || `Driver ${driver.driver_id.slice(0, 8)}`}
                </h1>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                  title="Edit name"
                >
                  <Pencil className="h-4 w-4 text-primary" />
                </button>
              </div>
            )}
            <p className="text-muted-foreground text-sm mt-1">
              {isOnline ? 'Online' : 'Offline'} • Connected via {driver.admin_code}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-warning border-warning/50 hover:bg-warning/10"
          >
            <Unlink className="h-4 w-4 mr-2" />
            {disconnecting ? 'Disconnecting...' : 'Disconnect'}
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/20">
                <Signal className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="font-semibold">{isOnline ? 'Online' : 'Offline'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-2 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/20">
                <Navigation className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Speed</p>
                <p className="font-semibold">
                  {locationHistory[0]?.speed 
                    ? `${Math.round(locationHistory[0].speed)} km/h` 
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-2 border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/20">
                <Calendar className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Connected</p>
                <p className="font-semibold text-sm">
                  {driver.connected_at 
                    ? new Date(driver.connected_at).toLocaleDateString() 
                    : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-fleet-blue/10 to-fleet-blue/5 border-2 border-fleet-blue/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-fleet-blue/20">
                <Activity className="h-5 w-5 text-fleet-blue" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Updates</p>
                <p className="font-semibold">{locationHistory.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Driver Location Map */}
      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <h3 className="font-heading font-semibold flex items-center gap-2 text-lg">
              <div className="p-1.5 rounded-lg bg-primary/20">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              Live Location & Trail
            </h3>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate(`/dashboard?focus=driver-${driver.driver_id}`)}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Full Map
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <DriverLocationMap
            driverName={driver.driver_name || 'Driver'}
            currentLocation={currentLocation}
            locationHistory={locationHistory.map(h => ({
              ...h,
              updated_at: h.recorded_at
            }))}
            isOnline={isOnline}
          />
          
          {/* Location stats */}
          {currentLocation && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Latitude</p>
                <p className="font-mono font-semibold text-sm">{currentLocation.latitude.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Longitude</p>
                <p className="font-mono font-semibold text-sm">{currentLocation.longitude.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Accuracy</p>
                <p className="font-semibold text-sm">{currentLocation.accuracy ? `±${Math.round(currentLocation.accuracy)}m` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Update</p>
                <p className="font-semibold text-sm">{currentLocation.updated_at 
                  ? new Date(currentLocation.updated_at).toLocaleString() 
                  : '—'}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Location History */}
      <Card className="border-2 border-border">
        <CardHeader className="pb-3">
          <h3 className="font-heading font-semibold flex items-center gap-2 text-lg">
            <div className="p-1.5 rounded-lg bg-primary/20">
              <Clock className="h-4 w-4 text-primary" />
            </div>
            Location History
          </h3>
        </CardHeader>
        <CardContent>
          {locationHistory.length === 0 ? (
            <div className="text-center py-8">
              <Clock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No location history available</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {locationHistory.map((loc, idx) => (
                <div 
                  key={idx}
                  className={clsx(
                    'flex items-center justify-between p-3 rounded-xl border-2 transition-all',
                    idx === 0 ? 'bg-primary/5 border-primary/30' : 'border-border hover:bg-muted/30'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'h-2.5 w-2.5 rounded-full',
                      idx === 0 ? 'bg-primary animate-pulse' : 'bg-muted-foreground'
                    )} />
                    <div>
                      <p className="font-mono text-sm font-medium">
                        {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {loc.recorded_at ? new Date(loc.recorded_at).toLocaleString() : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={clsx(
                      'text-sm font-semibold',
                      (loc.speed ?? 0) > 0 ? 'text-success' : 'text-muted-foreground'
                    )}>
                      {loc.speed ? `${Math.round(loc.speed)} km/h` : '0 km/h'}
                    </p>
                    {loc.accuracy && (
                      <p className="text-xs text-muted-foreground">±{Math.round(loc.accuracy)}m</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
