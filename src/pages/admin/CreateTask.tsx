import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import AddressAutocomplete from '@/components/AddressAutocomplete';

// Google Maps libraries - must be constant to avoid re-renders
const LIBRARIES: ('places')[] = ['places'];

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

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  useEffect(() => {
    checkAdminAccess();
    loadDrivers();
  }, []);

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
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(taskData)
        .select()
        .single();

      if (error) throw error;

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
    <div className="h-screen flex">
      {/* Left Panel - Form */}
      <div className="w-1/3 overflow-y-auto border-r bg-background p-6">
        <div className="max-w-xl">
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

      {/* Right Panel - Map */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: 0, lng: 0 }}
          zoom={2}
          onLoad={(map) => {
            mapRef.current = map;
          }}
          options={{
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: false,
          }}
        >
          {markers.map((marker, idx) => (
            <Marker
              key={idx}
              position={{ lat: marker.lat, lng: marker.lng }}
              icon={{
                url: marker.type === 'pickup'
                  ? 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%234ade80" stroke="%23ffffff" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
                  : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%233b82f6" stroke="%23ffffff" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>',
                scaledSize: new google.maps.Size(32, 32),
              }}
            />
          ))}
        </GoogleMap>
      </div>
    </div>
  );
}
