import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  ArrowLeft, MapPin, Clock, Navigation, Trash2, Unlink, 
  User, Activity, Calendar as CalendarIcon, Signal, AlertTriangle, Pencil, Check, X,
  Route, Gauge, Timer, TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import clsx from 'clsx';
import DriverLocationMap from '@/components/map/DriverLocationMap';
import { useDriverInsights, getTimeRange } from '@/hooks/useDriverInsights';

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

const TIME_RANGES = [
  { value: '1h', label: '1H' },
  { value: '4h', label: '4H' },
  { value: '12h', label: '12H' },
  { value: '24h', label: '24H' },
  { value: '3d', label: '3D' },
  { value: '7d', label: '7D' },
];

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
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  
  // Calendar date picker state
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [useCustomDate, setUseCustomDate] = useState(false);
  
  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Insights data
  const { data: insights, isLoading: insightsLoading } = useDriverInsights(
    driverId,
    useCustomDate && dateRange.from ? dateRange.from : getTimeRange(selectedTimeRange)
  );

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

        const { data: currentLocData } = await supabase
          .from('driver_locations')
          .select('latitude, longitude, speed, accuracy, updated_at')
          .eq('driver_id', driverId)
          .single();

        if (currentLocData) {
          setCurrentLocation(currentLocData as CurrentLocation);
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

  // Fetch location history based on time range or custom date
  useEffect(() => {
    if (!driverId) return;

    const fetchHistory = async () => {
      let since: Date;
      let until: Date | undefined;
      
      if (useCustomDate && dateRange.from) {
        since = new Date(dateRange.from);
        since.setHours(0, 0, 0, 0);
        if (dateRange.to) {
          until = new Date(dateRange.to);
          until.setHours(23, 59, 59, 999);
        } else {
          until = new Date(dateRange.from);
          until.setHours(23, 59, 59, 999);
        }
      } else {
        since = getTimeRange(selectedTimeRange);
      }
      
      let query = supabase
        .from('driver_location_history')
        .select('latitude, longitude, speed, accuracy, recorded_at')
        .eq('driver_id', driverId)
        .gte('recorded_at', since.toISOString())
        .order('recorded_at', { ascending: false })
        .limit(500);

      if (until) {
        query = query.lte('recorded_at', until.toISOString());
      }

      const { data: historyData } = await query;

      if (historyData) {
        setLocationHistory(historyData as LocationHistory[]);
      }
    };

    fetchHistory();
  }, [driverId, selectedTimeRange, useCustomDate, dateRange]);

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
      await supabase.from('driver_location_history').delete().eq('driver_id', driver.driver_id);
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

  const handleDateSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) {
      setDateRange({ from: range.from, to: range.to });
      setUseCustomDate(true);
    }
  };

  const clearCustomDate = () => {
    setDateRange({ from: undefined, to: undefined });
    setUseCustomDate(false);
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
    <div className="space-y-6 max-w-5xl">
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

      {/* Time Range Selector + Calendar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Range:</span>
        <div className="flex gap-1">
          {TIME_RANGES.map((range) => (
            <Button
              key={range.value}
              variant={!useCustomDate && selectedTimeRange === range.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectedTimeRange(range.value);
                clearCustomDate();
              }}
              className="whitespace-nowrap px-2.5"
            >
              {range.label}
            </Button>
          ))}
        </div>
        
        {/* Calendar Date Picker */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={useCustomDate ? 'default' : 'outline'}
              size="sm"
              className={cn(
                "gap-1.5",
                useCustomDate && "bg-primary text-primary-foreground"
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              {useCustomDate && dateRange.from ? (
                dateRange.to ? (
                  <span>{format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d')}</span>
                ) : (
                  <span>{format(dateRange.from, 'MMM d, yyyy')}</span>
                )
              ) : (
                <span>Pick Date</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange as any}
              onSelect={handleDateSelect as any}
              disabled={(date) => date > new Date()}
              numberOfMonths={1}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
            {useCustomDate && (
              <div className="p-2 border-t">
                <Button variant="ghost" size="sm" onClick={clearCustomDate} className="w-full text-xs">
                  Clear custom date
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="trail">Trail/History</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="trips">Trips</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
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
                    <p className="text-xs text-muted-foreground">Speed</p>
                    <p className="font-semibold">
                      {currentLocation?.speed 
                        ? `${Math.round(currentLocation.speed)} km/h` 
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
                    <CalendarIcon className="h-5 w-5 text-warning" />
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
                    <p className="text-xs text-muted-foreground">Points</p>
                    <p className="font-semibold">{locationHistory.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold flex items-center gap-2 text-lg">
                  <div className="p-1.5 rounded-lg bg-primary/20">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  Live Location
                </h3>
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trail/History Tab */}
        <TabsContent value="trail" className="space-y-6">
          <Card className="border-2 border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold flex items-center gap-2 text-lg">
                  <div className="p-1.5 rounded-lg bg-primary/20">
                    <Route className="h-4 w-4 text-primary" />
                  </div>
                  Location Trail
                </h3>
                <span className="text-sm text-muted-foreground">
                  {locationHistory.length} points
                </span>
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

          {/* Location History List */}
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
                  <p className="text-muted-foreground">No location history for this time range</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {locationHistory.slice(0, 50).map((loc, idx) => (
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
                  {locationHistory.length > 50 && (
                    <p className="text-center text-sm text-muted-foreground py-2">
                      Showing first 50 of {locationHistory.length} points
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="border-2 border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/20">
                    <Route className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="text-xl font-bold">
                      {insightsLoading ? '...' : `${(insights?.distance_km || 0).toFixed(1)} km`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/20">
                    <Gauge className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Speed</p>
                    <p className="text-xl font-bold">
                      {insightsLoading ? '...' : `${Math.round(insights?.avg_speed_kmh || 0)} km/h`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-warning/20">
                    <TrendingUp className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Max Speed</p>
                    <p className="text-xl font-bold">
                      {insightsLoading ? '...' : `${Math.round(insights?.max_speed_kmh || 0)} km/h`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/20">
                    <Timer className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Idle Time</p>
                    <p className="text-xl font-bold">
                      {insightsLoading ? '...' : `${Math.round(insights?.idle_minutes || 0)}m`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-fleet-blue/20">
                    <Activity className="h-5 w-5 text-fleet-blue" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Active Time</p>
                    <p className="text-xl font-bold">
                      {insightsLoading ? '...' : `${Math.round(insights?.active_minutes || 0)}m`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 border-border">
            <CardHeader className="pb-3">
              <h3 className="font-heading font-semibold flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-primary/20">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                Activity Summary
              </h3>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-primary">
                    {insightsLoading ? '...' : insights?.total_points || 0}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Location Updates</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-success">
                    {insightsLoading ? '...' : `${(insights?.distance_km || 0).toFixed(1)}`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Kilometers</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-warning">
                    {insightsLoading ? '...' : `${Math.round((insights?.active_minutes || 0) + (insights?.idle_minutes || 0))}`}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Total Minutes</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-bold text-fleet-blue">
                    {insightsLoading ? '...' : 
                      `${Math.round(((insights?.active_minutes || 0) / ((insights?.active_minutes || 0) + (insights?.idle_minutes || 1))) * 100)}%`
                    }
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Activity Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trips Tab */}
        <TabsContent value="trips" className="space-y-6">
          <Card className="border-2 border-border">
            <CardHeader className="pb-3">
              <h3 className="font-heading font-semibold flex items-center gap-2 text-lg">
                <div className="p-1.5 rounded-lg bg-primary/20">
                  <Route className="h-4 w-4 text-primary" />
                </div>
                Driver Trips
              </h3>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Route className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">Trip history coming soon</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This will show individual trips detected from the driver's movement patterns.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
