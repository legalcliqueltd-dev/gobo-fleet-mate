import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import LockedFeature from '@/components/LockedFeature';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import AdvancedMarker from '@/components/map/AdvancedMarker';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Calendar, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { useTheme } from '@/contexts/ThemeContext';
import { getMapStyle } from '@/lib/mapStyles';

// Google Maps libraries are imported from shared config to ensure all
// useJsApiLoader instances share identical options.

// Driver type matching the drivers table (mobile app drivers)
type Driver = {
  driver_id: string;
  driver_name: string | null;
  admin_code: string;
  status: string | null;
  last_seen_at: string | null;
};

type LocationMarker = {
  lat: number;
  lng: number;
  type: 'pickup' | 'dropoff';
};

export default function CreateTask() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mapRef = useRef<google.maps.Map | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedDriverId, setAssignedDriverId] = useState('');
  const [selectedAdminCode, setSelectedAdminCode] = useState('');
  const [dueDate, setDueDate] = useState('');
  
  // Address-based location state
  const [pickupAddress, setPickupAddress] = useState('');
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState('');
  const [dropoffLat, setDropoffLat] = useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = useState<number | null>(null);
  const [dropoffRadius, setDropoffRadius] = useState('150');
  
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showMap, setShowMap] = useState(false);

  // Delivery code — docs/DELIVERY_CODE_SPEC.md. Off by default: most jobs do
  // not need one, and a feature that imposes itself gets switched off.
  const [needsCode, setNeedsCode] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [expiresInMinutes, setExpiresInMinutes] = useState(1440);
  const { isDark } = useTheme();

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  useEffect(() => {
    checkAdminAccess();
    loadDrivers();
  }, []);

  // Pre-select driver from URL params
  useEffect(() => {
    const driverParam = searchParams.get('driver');
    const codeParam = searchParams.get('code');
    if (driverParam && drivers.length > 0) {
      setAssignedDriverId(driverParam);
      if (codeParam) setSelectedAdminCode(codeParam);
    }
  }, [searchParams, drivers]);

  // Update markers when locations change
  useEffect(() => {
    const newMarkers: LocationMarker[] = [];
    if (pickupLat && pickupLng) {
      newMarkers.push({ lat: pickupLat, lng: pickupLng, type: 'pickup' });
    }
    if (dropoffLat && dropoffLng) {
      newMarkers.push({ lat: dropoffLat, lng: dropoffLng, type: 'dropoff' });
    }
    setMarkers(newMarkers);

    // Pan to the most recent marker
    if (mapRef.current && newMarkers.length > 0) {
      const lastMarker = newMarkers[newMarkers.length - 1];
      mapRef.current.panTo({ lat: lastMarker.lat, lng: lastMarker.lng });
      mapRef.current.setZoom(14);
    }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng]);

  const checkAdminAccess = async () => {
    try {
      if (!user) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      
      if (!data) {
        toast.error('Admin access required');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Admin access check failed:', error);
    }
  };

  const loadDrivers = async () => {
    try {
      if (!user) return;

      const { data: devices } = await supabase
        .from('devices')
        .select('connection_code')
        .eq('user_id', user.id)
        .not('connection_code', 'is', null);

      if (!devices || devices.length === 0) {
        return;
      }

      const connectionCodes = devices
        .map(d => d.connection_code)
        .filter((code): code is string => code !== null);

      const { data: driversData, error } = await supabase
        .from('drivers')
        .select('driver_id, driver_name, admin_code, status, last_seen_at')
        .in('admin_code', connectionCodes);

      if (error) {
        console.error('Error loading drivers:', error);
        return;
      }

      if (driversData && driversData.length > 0) {
        setDrivers(driversData);
      }
    } catch (error) {
      console.error('Failed to load drivers:', error);
    }
  };

  const handleDriverSelect = (driverId: string) => {
    setAssignedDriverId(driverId);
    // Also store the admin_code for the selected driver
    const selectedDriver = drivers.find(d => d.driver_id === driverId);
    if (selectedDriver) {
      setSelectedAdminCode(selectedDriver.admin_code);
    }
  };

  const handlePickupAddressChange = (address: string, lat: number, lng: number) => {
    setPickupAddress(address);
    setPickupLat(lat);
    setPickupLng(lng);
  };

  const handleDropoffAddressChange = (address: string, lat: number, lng: number) => {
    setDropoffAddress(address);
    setDropoffLat(lat);
    setDropoffLng(lng);
  };

  const handleCreateTask = async () => {
    if (!user) return;

    // Validation
    if (!title.trim()) {
      toast.error('Task title is required');
      return;
    }

    if (!assignedDriverId) {
      toast.error('Please select a driver');
      return;
    }

    if (!dropoffLat || !dropoffLng) {
      toast.error('Dropoff location is required');
      return;
    }

    setSubmitting(true);

    try {
      const taskData = {
        created_by: user.id,
        assigned_user_id: user.id, // Keep for RLS compatibility
        assigned_driver_id: assignedDriverId, // Text-based driver ID for mobile app
        admin_code: selectedAdminCode, // Link to admin for filtering
        title: title.trim(),
        description: description.trim() || null,
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
        dropoff_radius_m: parseInt(dropoffRadius) || 150,
        due_at: dueDate ? new Date(dueDate).toISOString() : null,
        status: 'assigned',
        requires_delivery_code: needsCode,
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

      if (needsCode) {
        // Issued server-side; the plaintext code never reaches this browser.
        const { data: issued, error: codeError } = await supabase.functions.invoke(
          'delivery-code',
          {
            body: {
              action: 'issue',
              taskId: data?.id,
              customerName: customerName.trim() || null,
              customerEmail: customerEmail.trim() || null,
              expiresInMinutes,
              sendVia: customerEmail.trim() ? ['email'] : [],
            },
          }
        );
        if (codeError || !issued?.success) {
          // The task exists; only the code failed. Say so rather than letting
          // a half-done job look finished.
          toast.warning('Task created, but the delivery code could not be sent.');
          navigate('/admin/tasks');
          return;
        }
      }

      toast.success('Task created successfully');
      navigate('/admin/tasks');
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast.error(error.message || 'Failed to create task');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <LockedFeature featureName="Task Creation">
    <div className="mx-auto max-w-xl">
        <div>
          <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Package className="h-6 w-6" />
            Create New Task
          </h1>

          <div className="space-y-6">
            {/* Basic Info */}
            <Card className="bg-background/50 backdrop-blur border border-border">
              <CardHeader>
                <h2 className="text-lg font-semibold">Task Details</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Delivery to..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Additional details..."
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="driver">Assign to Driver *</Label>
                  <Select value={assignedDriverId} onValueChange={handleDriverSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.driver_id} value={driver.driver_id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${driver.status === 'active' ? 'bg-green-500' : 'bg-gray-400'}`} />
                            {driver.driver_name || driver.driver_id}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="due">Due Date/Time</Label>
                  <Input
                    id="due"
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Locations - Address Search */}
            <Card className="bg-background/50 backdrop-blur border border-border">
              <CardHeader>
                <h2 className="text-lg font-semibold">Locations</h2>
                <p className="text-sm text-muted-foreground">
                  Search and select addresses for pickup and dropoff
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Pickup Address (Optional)</Label>
                  <div className="mt-2">
                    <AddressAutocomplete
                      value={pickupAddress}
                      onChange={handlePickupAddressChange}
                      placeholder="Search pickup location..."
                    />
                  </div>
                  {pickupLat && pickupLng && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📍 {pickupLat.toFixed(6)}, {pickupLng.toFixed(6)}
                    </p>
                  )}
                </div>

                <div>
                  <Label>Dropoff Address *</Label>
                  <div className="mt-2">
                    <AddressAutocomplete
                      value={dropoffAddress}
                      onChange={handleDropoffAddressChange}
                      placeholder="Search dropoff location..."
                    />
                  </div>
                  {dropoffLat && dropoffLng && (
                    <p className="text-xs text-muted-foreground mt-1">
                      📍 {dropoffLat.toFixed(6)}, {dropoffLng.toFixed(6)}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="radius">Dropoff Radius (meters)</Label>
                  <Input
                    id="radius"
                    type="number"
                    value={dropoffRadius}
                    onChange={(e) => setDropoffRadius(e.target.value)}
                  />
                </div>

                {/* Map is on-demand: search sets the location; the map just confirms it. */}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => setShowMap((v) => !v)}
                  >
                    {showMap ? 'Hide map' : markers.length > 0 ? 'Check locations on map' : 'Show map'}
                  </Button>
                  {showMap && (
                    <div className="mt-3 h-72 overflow-hidden rounded-lg border border-border">
                      <GoogleMap
                        mapContainerStyle={{ width: '100%', height: '100%' }}
                        center={markers.length > 0 ? { lat: markers[0].lat, lng: markers[0].lng } : { lat: 6.5244, lng: 3.3792 }}
                        zoom={markers.length > 0 ? 13 : 11}
                        onLoad={(map) => {
                          mapRef.current = map;
                          if (markers.length > 1) {
                            const bounds = new google.maps.LatLngBounds();
                            markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
                            map.fitBounds(bounds, 48);
                          }
                        }}
                        options={{
                          disableDefaultUI: true,
                          zoomControl: true,
                          streetViewControl: false,
                          styles: getMapStyle(isDark),
                        }}
                      >
                        {markers.map((marker, idx) => (
                          <AdvancedMarker
                            key={idx}
                            position={{ lat: marker.lat, lng: marker.lng }}
                            iconUrl={
                              marker.type === 'pickup'
                                ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%234ade80" stroke="%23ffffff" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
                                : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%233b82f6" stroke="%23ffffff" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
                            }
                            iconSize={32}
                          />
                        ))}
                      </GoogleMap>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Delivery code */}
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Label className="flex items-center gap-2 text-base">
                      <ShieldCheck className="h-4 w-4" />
                      Delivery code
                    </Label>
                    {/* One line, naming the consequence rather than the
                        mechanism. It is the only training the owner gets. */}
                    <p className="mt-1 text-sm text-muted-foreground">
                      The customer gets a code. Your driver cannot finish this
                      job without it.
                    </p>
                  </div>
                  <Switch checked={needsCode} onCheckedChange={setNeedsCode} />
                </div>

                {needsCode && (
                  <div className="space-y-3 border-t pt-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="customerName">Customer name</Label>
                        <Input
                          id="customerName"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Who is receiving it"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="customerEmail">Customer email</Label>
                        <Input
                          id="customerEmail"
                          type="email"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          placeholder="Where the code is sent"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="codeExpiry">Code expires</Label>
                      <select
                        id="codeExpiry"
                        value={expiresInMinutes}
                        onChange={(e) => setExpiresInMinutes(Number(e.target.value))}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value={15}>15 minutes</option>
                        <option value={60}>1 hour</option>
                        <option value={360}>6 hours</option>
                        <option value={1440}>24 hours</option>
                        <option value={2880}>2 days</option>
                        <option value={10080}>7 days</option>
                      </select>
                    </div>

                    <p className="text-xs leading-relaxed text-muted-foreground">
                      You will never see the code yourself. That is what stops
                      anyone but the customer confirming the delivery.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/admin/tasks')}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateTask}
                disabled={submitting}
              >
                {submitting ? 'Creating...' : 'Create Task'}
              </Button>
            </div>
          </div>
        </div>
    </div>
    </LockedFeature>
  );
}
