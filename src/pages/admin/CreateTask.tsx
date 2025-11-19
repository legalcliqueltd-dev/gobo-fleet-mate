import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
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
import { Package, MapPin, Calendar, User } from 'lucide-react';
import { toast } from 'sonner';

type Driver = {
  id: string;
  email: string;
  full_name: string | null;
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
  const [dueDate, setDueDate] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLng, setPickupLng] = useState('');
  const [dropoffLat, setDropoffLat] = useState('');
  const [dropoffLng, setDropoffLng] = useState('');
  const [dropoffRadius, setDropoffRadius] = useState('150');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [markers, setMarkers] = useState<LocationMarker[]>([]);
  const [markerMode, setMarkerMode] = useState<'pickup' | 'dropoff' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    checkAdminAccess();
    loadDrivers();
  }, []);

  const checkAdminAccess = async () => {
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
  };

  const loadDrivers = async () => {
    if (!user) return;

    // Get connected drivers
    const { data: connections } = await supabase
      .from('driver_connections')
      .select('driver_user_id')
      .eq('admin_user_id', user.id)
      .eq('status', 'active');

    if (!connections || connections.length === 0) {
      toast.error('No active drivers connected');
      return;
    }

    const driverIds = connections.map(c => c.driver_user_id);

    // Get driver profiles
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', driverIds);

    if (profiles) {
      setDrivers(profiles);
    }
  };

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!markerMode || !e.latLng) return;

    const lat = e.latLng.lat();
    const lng = e.latLng.lng();

    if (markerMode === 'pickup') {
      setPickupLat(lat.toFixed(6));
      setPickupLng(lng.toFixed(6));
      setMarkers(prev => [...prev.filter(m => m.type !== 'pickup'), { lat, lng, type: 'pickup' }]);
    } else {
      setDropoffLat(lat.toFixed(6));
      setDropoffLng(lng.toFixed(6));
      setMarkers(prev => [...prev.filter(m => m.type !== 'dropoff'), { lat, lng, type: 'dropoff' }]);
    }

    setMarkerMode(null);
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
        assigned_user_id: assignedDriverId,
        title: title.trim(),
        description: description.trim() || null,
        pickup_lat: pickupLat ? parseFloat(pickupLat) : null,
        pickup_lng: pickupLng ? parseFloat(pickupLng) : null,
        dropoff_lat: parseFloat(dropoffLat),
        dropoff_lng: parseFloat(dropoffLng),
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
            <Card variant="glass">
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
                  <Select value={assignedDriverId} onValueChange={setAssignedDriverId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>
                          {driver.full_name || driver.email}
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

            {/* Locations */}
            <Card variant="glass">
              <CardHeader>
                <h2 className="text-lg font-semibold">Locations</h2>
                <p className="text-sm text-muted-foreground">
                  Click markers on map or enter coordinates
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Pickup Location (Optional)</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Latitude"
                      value={pickupLat}
                      onChange={(e) => setPickupLat(e.target.value)}
                    />
                    <Input
                      placeholder="Longitude"
                      value={pickupLng}
                      onChange={(e) => setPickupLng(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setMarkerMode(markerMode === 'pickup' ? null : 'pickup')}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {markerMode === 'pickup' ? 'Cancel' : 'Click on Map'}
                  </Button>
                </div>

                <div>
                  <Label>Dropoff Location *</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Latitude"
                      value={dropoffLat}
                      onChange={(e) => setDropoffLat(e.target.value)}
                    />
                    <Input
                      placeholder="Longitude"
                      value={dropoffLng}
                      onChange={(e) => setDropoffLng(e.target.value)}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => setMarkerMode(markerMode === 'dropoff' ? null : 'dropoff')}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {markerMode === 'dropoff' ? 'Cancel' : 'Click on Map'}
                  </Button>
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
        {markerMode && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
            <Card variant="glass">
              <CardContent className="p-3">
                <p className="text-sm font-medium">
                  Click on the map to set {markerMode} location
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: 0, lng: 0 }}
          zoom={2}
          onLoad={(map) => {
            mapRef.current = map;
          }}
          onClick={handleMapClick}
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
