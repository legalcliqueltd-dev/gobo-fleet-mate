import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleMap, Marker, useJsApiLoader, Polyline } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';
import { AlertTriangle, CheckCircle, Clock, MapPin, Image, User, Calendar, ZoomIn, Map, Satellite, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type SOSEvent = {
  id: string;
  user_id: string;
  device_id: string | null;
  admin_code: string | null;
  hazard: string;
  message: string | null;
  photo_url: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolved_note: string | null;
  status: string;
  // Enriched fields
  driver_name?: string;
  driver_email?: string;
  driver_code?: string;
};

type PositionUpdate = {
  id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
};

export default function Incidents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SOSEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SOSEvent | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [positionTrail, setPositionTrail] = useState<PositionUpdate[]>([]);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite' | 'hybrid'>('roadmap');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<string | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    checkAdmin();
    loadEvents();
    const cleanup = subscribeToEvents();
    return cleanup;
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadPositionTrail(selectedEvent.id);
    } else {
      setPositionTrail([]);
    }
  }, [selectedEvent?.id]);

  const checkAdmin = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();
    setIsAdmin(!!data);
  };

  const loadEvents = async () => {
    setLoading(true);
    const { data: rawEvents, error } = await supabase
      .from('sos_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading SOS events:', error);
      setLoading(false);
      return;
    }

    if (rawEvents) {
      // Enrich events with driver info
      const enrichedEvents: SOSEvent[] = await Promise.all(
        rawEvents.map(async (event) => {
          // First try to get driver from drivers table using user_id as driver_id
          const { data: driver } = await supabase
            .from('drivers')
            .select('driver_id, driver_name, admin_code')
            .eq('driver_id', event.user_id)
            .single();

          if (driver) {
            return {
              ...event,
              driver_name: driver.driver_name || 'Unknown Driver',
              driver_code: driver.admin_code,
              driver_email: '',
            };
          }

          // Fallback to profiles table for UUID-based users
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', event.user_id)
            .single();

          return {
            ...event,
            driver_name: profile?.full_name || 'Unknown Driver',
            driver_email: profile?.email || '',
            driver_code: event.admin_code || '',
          };
        })
      );

      setEvents(enrichedEvents);
      
      // Auto-select first open event
      const firstOpen = enrichedEvents.find(e => e.status === 'open');
      if (firstOpen && !selectedEvent) {
        setSelectedEvent(firstOpen);
      }
    }
    setLoading(false);
  };

  const loadPositionTrail = async (sosId: string) => {
    const { data, error } = await supabase
      .from('sos_position_updates')
      .select('id, latitude, longitude, timestamp')
      .eq('sos_event_id', sosId)
      .order('timestamp', { ascending: true });

    if (!error && data) {
      setPositionTrail(data);
    }
  };

  const subscribeToEvents = () => {
    const channel = supabase
      .channel('sos-events-ops')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sos_events',
        },
        () => {
          loadEvents();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sos_position_updates',
        },
        (payload) => {
          if (selectedEvent && payload.new.sos_event_id === selectedEvent.id) {
            setPositionTrail(prev => [...prev, payload.new as PositionUpdate]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const acknowledgeEvent = async (eventId: string) => {
    if (!user || !isAdmin) return;
    const { error } = await supabase
      .from('sos_events')
      .update({
        status: 'acknowledged',
        acknowledged_by: user.id,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', eventId);

    if (!error) {
      toast.success('SOS acknowledged');
      loadEvents();
    } else {
      toast.error('Failed to acknowledge');
    }
  };

  const resolveEvent = async (eventId: string) => {
    if (!user || !isAdmin) return;
    const { error } = await supabase
      .from('sos_events')
      .update({
        status: 'resolved',
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolved_note: resolveNote || null,
      })
      .eq('id', eventId);

    if (!error) {
      toast.success('SOS resolved');
      setResolveNote('');
      setSelectedEvent(null);
      loadEvents();
    } else {
      toast.error('Failed to resolve');
    }
  };

  const deleteEvent = async (eventId: string) => {
    const { error } = await supabase
      .from('sos_events')
      .delete()
      .eq('id', eventId);

    if (!error) {
      toast.success('SOS event deleted');
      if (selectedEvent?.id === eventId) {
        setSelectedEvent(null);
      }
      loadEvents();
    } else {
      toast.error('Failed to delete event');
    }
    setDeleteDialogOpen(false);
    setEventToDelete(null);
  };

  const handleDeleteClick = (eventId: string) => {
    setEventToDelete(eventId);
    setDeleteDialogOpen(true);
  };

  const zoomToLocation = useCallback(() => {
    if (mapRef.current && selectedEvent?.latitude && selectedEvent?.longitude) {
      mapRef.current.panTo({ lat: selectedEvent.latitude, lng: selectedEvent.longitude });
      mapRef.current.setZoom(18);
    }
  }, [selectedEvent]);

  const openInGoogleMaps = useCallback(() => {
    if (selectedEvent?.latitude && selectedEvent?.longitude) {
      window.open(
        `https://www.google.com/maps?q=${selectedEvent.latitude},${selectedEvent.longitude}`,
        '_blank'
      );
    }
  }, [selectedEvent]);

  const centerLocation = useMemo(() => {
    if (selectedEvent && selectedEvent.latitude && selectedEvent.longitude) {
      return { latitude: selectedEvent.latitude, longitude: selectedEvent.longitude, zoom: 15 };
    }
    const openEvents = events.filter((e) => e.status === 'open' && e.latitude && e.longitude);
    if (openEvents.length > 0) {
      return { latitude: openEvents[0].latitude!, longitude: openEvents[0].longitude!, zoom: 12 };
    }
    return { latitude: 0, longitude: 0, zoom: 2 };
  }, [selectedEvent, events]);

  const statusBadge = (status: string) => {
    const variants: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
      open: 'destructive',
      acknowledged: 'default',
      resolved: 'secondary',
      cancelled: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };

  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'open': return '#ef4444';
      case 'acknowledged': return '#eab308';
      case 'resolved': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const hazardEmoji = (hazard: string) => {
    const emojis: Record<string, string> = {
      accident: '🚗',
      medical: '🏥',
      robbery: '🚨',
      breakdown: '🔧',
      other: '⚠️',
    };
    return emojis[hazard] || '⚠️';
  };

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Operations - Incidents</h1>
        <div className="glass-card rounded-xl p-6">
          <p className="text-muted-foreground">Access denied. Admin role required.</p>
        </div>
      </div>
    );
  }

  const activeEvents = events.filter(e => e.status !== 'resolved' && e.status !== 'cancelled');
  const resolvedEvents = events.filter(e => e.status === 'resolved' || e.status === 'cancelled');

  return (
    <div className="h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold">Incident Management</h1>
          <Badge variant={activeEvents.length > 0 ? 'destructive' : 'secondary'} className="text-sm px-3 py-1">
            {activeEvents.length} Active
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Events List */}
        <div className="glass-card rounded-xl p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Active Incidents ({activeEvents.length})
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : activeEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active incidents</p>
          ) : (
            <div className="space-y-3">
              {activeEvents.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedEvent?.id === evt.id
                      ? 'border-primary bg-primary/5 shadow-lg'
                      : 'border-border hover:border-primary/50 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{hazardEmoji(evt.hazard)}</span>
                      <div>
                        <p className="font-semibold text-base">{evt.driver_name}</p>
                        {evt.driver_code && (
                          <p className="text-xs font-mono bg-muted px-2 py-0.5 rounded inline-block mt-0.5">
                            {evt.driver_code}
                          </p>
                        )}
                      </div>
                    </div>
                    {statusBadge(evt.status)}
                  </div>
                  <p className="text-xs text-muted-foreground uppercase font-medium mb-1">{evt.hazard}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}
                  </p>
                  {evt.photo_url && (
                    <div className="mt-2">
                      <img
                        src={evt.photo_url}
                        alt="Evidence"
                        className="w-full h-16 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {resolvedEvents.length > 0 && (
            <>
              <h2 className="font-semibold mt-6 mb-3 flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-4 w-4" />
                Resolved ({resolvedEvents.length})
              </h2>
              <div className="space-y-2">
                {resolvedEvents.slice(0, 10).map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`p-3 rounded-lg border cursor-pointer transition opacity-70 hover:opacity-100 flex items-center justify-between ${
                      selectedEvent?.id === evt.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div>
                      <span className="text-sm font-medium">{evt.driver_name}</span>
                      {evt.driver_code && (
                        <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded ml-2">
                          {evt.driver_code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {statusBadge(evt.status)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(evt.id);
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive transition"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Map */}
        <div className="lg:col-span-2 glass-card rounded-xl overflow-hidden relative">
          {!isLoaded ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: centerLocation.latitude, lng: centerLocation.longitude }}
              zoom={centerLocation.zoom}
              onLoad={(map) => { mapRef.current = map; }}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
                mapTypeId: mapType,
              }}
            >
              {/* SOS Event Markers */}
              {events
                .filter((e) => e.latitude && e.longitude)
                .map((evt) => (
                  <Marker
                    key={evt.id}
                    position={{ lat: evt.latitude!, lng: evt.longitude! }}
                    onClick={() => setSelectedEvent(evt)}
                    icon={{
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: selectedEvent?.id === evt.id ? 18 : 14,
                      fillColor: getMarkerColor(evt.status),
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 3,
                    }}
                    animation={evt.status === 'open' ? google.maps.Animation.BOUNCE : undefined}
                  />
                ))}

              {/* Position Trail Polyline */}
              {positionTrail.length > 1 && (
                <Polyline
                  path={positionTrail.map(p => ({ lat: p.latitude, lng: p.longitude }))}
                  options={{
                    strokeColor: '#3b82f6',
                    strokeOpacity: 0.8,
                    strokeWeight: 3,
                    geodesic: true,
                  }}
                />
              )}

              {/* Position Trail Markers */}
              {positionTrail.map((pos, idx) => (
                <Marker
                  key={pos.id}
                  position={{ lat: pos.latitude, lng: pos.longitude }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    fillColor: '#3b82f6',
                    fillOpacity: 0.6,
                    strokeColor: '#ffffff',
                    strokeWeight: 1,
                  }}
                  title={`Update ${idx + 1}: ${new Date(pos.timestamp).toLocaleTimeString()}`}
                />
              ))}
            </GoogleMap>
          )}

          {/* Map Type Toggle */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              size="sm"
              variant={mapType === 'roadmap' ? 'default' : 'secondary'}
              onClick={() => setMapType('roadmap')}
              className="shadow-lg"
            >
              <Map className="h-4 w-4 mr-1" />
              Map
            </Button>
            <Button
              size="sm"
              variant={mapType === 'satellite' ? 'default' : 'secondary'}
              onClick={() => setMapType('satellite')}
              className="shadow-lg"
            >
              <Satellite className="h-4 w-4 mr-1" />
              Satellite
            </Button>
          </div>

          {/* Selected Event Details Panel */}
          {selectedEvent && (
            <div className="absolute bottom-4 left-4 right-4 glass-card rounded-xl p-4 max-w-lg max-h-[60%] overflow-y-auto shadow-2xl">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{selectedEvent.driver_name}</h3>
                    {selectedEvent.driver_code && (
                      <p className="text-xs font-mono bg-muted px-2 py-0.5 rounded inline-block">
                        Code: {selectedEvent.driver_code}
                      </p>
                    )}
                    {selectedEvent.driver_email && (
                      <p className="text-xs text-muted-foreground">{selectedEvent.driver_email}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-muted-foreground hover:text-foreground text-2xl font-light"
                >
                  ×
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-3xl">{hazardEmoji(selectedEvent.hazard)}</span>
                <span className="font-semibold text-lg">{selectedEvent.hazard.toUpperCase()}</span>
                {statusBadge(selectedEvent.status)}
              </div>

              <div className="text-sm text-muted-foreground mb-3 flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {new Date(selectedEvent.created_at).toLocaleString()}
                </span>
                {selectedEvent.latitude && selectedEvent.longitude && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {selectedEvent.latitude.toFixed(5)}, {selectedEvent.longitude.toFixed(5)}
                  </span>
                )}
              </div>

              {/* Map Action Buttons */}
              {selectedEvent.latitude && selectedEvent.longitude && (
                <div className="flex gap-2 mb-3">
                  <Button size="sm" variant="outline" onClick={zoomToLocation}>
                    <ZoomIn className="h-4 w-4 mr-1" />
                    Zoom to Location
                  </Button>
                  <Button size="sm" variant="outline" onClick={openInGoogleMaps}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open in Maps
                  </Button>
                </div>
              )}

              {selectedEvent.message && (
                <div className="p-3 bg-muted rounded-lg mb-3">
                  <p className="text-sm">{selectedEvent.message}</p>
                </div>
              )}

              {/* Photo Evidence */}
              {selectedEvent.photo_url && (
                <div className="mb-3">
                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    Photo Evidence
                  </p>
                  <img
                    src={selectedEvent.photo_url}
                    alt="Evidence"
                    className="w-full max-h-40 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                    onClick={() => setPhotoModalOpen(true)}
                  />
                </div>
              )}

              {/* Position Trail Info */}
              {positionTrail.length > 0 && (
                <p className="text-xs text-muted-foreground mb-3">
                  📍 {positionTrail.length} position update{positionTrail.length > 1 ? 's' : ''} tracked
                </p>
              )}

              {/* Action Buttons */}
              {selectedEvent.status === 'open' && (
                <Button
                  size="sm"
                  onClick={() => acknowledgeEvent(selectedEvent.id)}
                  className="w-full mb-2"
                >
                  <Clock className="h-4 w-4 mr-2" />
                  Acknowledge
                </Button>
              )}

              {selectedEvent.status === 'acknowledged' && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Resolution note..."
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    rows={2}
                  />
                  <Button
                    size="sm"
                    onClick={() => resolveEvent(selectedEvent.id)}
                    className="w-full"
                    variant="default"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Resolve
                  </Button>
                </div>
              )}

              {selectedEvent.resolved_note && (
                <div className="mt-3 p-2 bg-green-500/10 rounded-lg">
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">
                    ✓ Resolved: {selectedEvent.resolved_note}
                  </p>
                </div>
              )}

              {/* Delete Button for resolved events */}
              {(selectedEvent.status === 'resolved' || selectedEvent.status === 'cancelled') && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteClick(selectedEvent.id)}
                  className="w-full mt-3"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Event
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Photo Modal */}
      {photoModalOpen && selectedEvent?.photo_url && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPhotoModalOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={selectedEvent.photo_url}
              alt="Evidence"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setPhotoModalOpen(false)}
              className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SOS Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The SOS event and all associated data will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => eventToDelete && deleteEvent(eventToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
