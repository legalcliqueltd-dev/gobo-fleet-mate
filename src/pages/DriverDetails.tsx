import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { 
  ArrowLeft, MapPin, Clock, Navigation, Trash2, Unlink, 
  User, Activity, Calendar, Signal, AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

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
  updated_at: string | null;
};

export default function DriverDetails() {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [driver, setDriver] = useState<DriverDetail | null>(null);
  const [locationHistory, setLocationHistory] = useState<LocationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    if (!driverId || !user) return;

    const fetchDriver = async () => {
      try {
        // Fetch driver details
        const { data: driverData, error: driverError } = await supabase
          .from('drivers')
          .select('*')
          .eq('driver_id', driverId)
          .single();

        if (driverError) throw driverError;
        setDriver(driverData as DriverDetail);

        // Fetch location history
        const { data: locData, error: locError } = await supabase
          .from('driver_locations')
          .select('*')
          .eq('driver_id', driverId)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (!locError && locData) {
          setLocationHistory(locData as LocationHistory[]);
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

  const handleDisconnect = async () => {
    if (!driver) return;
    setDisconnecting(true);

    try {
      // Update driver status to disconnected
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
      // Delete location history first
      await supabase
        .from('driver_locations')
        .delete()
        .eq('driver_id', driver.driver_id);

      // Delete driver
      const { error } = await supabase
        .from('drivers')
        .delete()
        .eq('driver_id', driver.driver_id);

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold flex items-center gap-3">
              <div className={clsx(
                'h-3 w-3 rounded-full',
                isOnline ? 'bg-success animate-pulse' : 'bg-muted-foreground'
              )} />
              {driver.driver_name || `Driver ${driver.driver_id.slice(0, 8)}`}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isOnline ? 'Online' : 'Offline'} • Connected via {driver.admin_code}
            </p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-warning border-warning hover:bg-warning/10"
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
            {deleting ? 'Deleting...' : 'Delete Driver'}
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
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

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
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

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
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

        <Card className="bg-gradient-to-br from-fleet-blue/10 to-fleet-blue/5 border-fleet-blue/20">
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

      {/* Current Location */}
      {locationHistory[0] && (
        <Card>
          <CardHeader>
            <h3 className="font-heading font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Current Location
            </h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Latitude</p>
                <p className="font-mono">{locationHistory[0].latitude.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Longitude</p>
                <p className="font-mono">{locationHistory[0].longitude.toFixed(6)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Accuracy</p>
                <p>{locationHistory[0].accuracy ? `${Math.round(locationHistory[0].accuracy)}m` : '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Last Update</p>
                <p>{locationHistory[0].updated_at 
                  ? new Date(locationHistory[0].updated_at).toLocaleString() 
                  : '—'}</p>
              </div>
            </div>
            <Button 
              className="mt-4" 
              variant="outline"
              onClick={() => navigate(`/dashboard?focus=driver-${driver.driver_id}`)}
            >
              <MapPin className="h-4 w-4 mr-2" />
              View on Map
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Location History */}
      <Card>
        <CardHeader>
          <h3 className="font-heading font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Location History
          </h3>
        </CardHeader>
        <CardContent>
          {locationHistory.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No location history available</p>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {locationHistory.map((loc, idx) => (
                <div 
                  key={idx}
                  className={clsx(
                    'flex items-center justify-between p-3 rounded-lg border',
                    idx === 0 ? 'bg-primary/5 border-primary/20' : 'border-border'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={clsx(
                      'h-2 w-2 rounded-full',
                      idx === 0 ? 'bg-primary' : 'bg-muted-foreground'
                    )} />
                    <div>
                      <p className="font-mono text-sm">
                        {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {loc.updated_at ? new Date(loc.updated_at).toLocaleString() : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
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
