import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleMap, Marker, useJsApiLoader, InfoWindow, Polyline } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';
import { AlertTriangle, CheckCircle, Clock, Phone, MapPin, Image, User, Calendar } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

type SOSEvent = {
  id: string;
  user_id: string;
  device_id: string | null;
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
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email')
            .eq('id', event.user_id)
            .single();

          return {
            ...event,
            driver_name: profile?.full_name || 'Unknown Driver',
            driver_email: profile?.email || '',
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
        <h1 className="text-3xl font-bold">Incident Management</h1>
        <Badge variant={activeEvents.length > 0 ? 'destructive' : 'secondary'} className="text-sm px-3 py-1">
          {activeEvents.length} Active
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Events List */}
        <div className="glass-card rounded-xl p-4 overflow-y-auto max-h-[calc(100vh-280px)]">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            Active Incidents ({activeEvents.length})
          </h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : activeEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active incidents</p>
          ) : (
            <div className="space-y-2">
              {activeEvents.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className={`p-3 rounded-lg border-2 cursor-pointer transition ${
                    selectedEvent?.id === evt.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{hazardEmoji(evt.hazard)}</span>
                      <div>
                        <p className="font-medium text-sm">{evt.driver_name}</p>
                        <p className="text-xs text-muted-foreground">{evt.hazard.toUpperCase()}</p>
                      </div>
                    </div>
                    {statusBadge(evt.status)}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                    <Calendar className="h-3 w-3" />
                    {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}
                  </p>
                  {evt.photo_url && (
                    <div className="mt-2">
                      <img
                        src={evt.photo_url}
                        alt="Evidence"
                        className="w-full h-16 object-cover rounded"
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
                {resolvedEvents.slice(0, 5).map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`p-2 rounded-lg border cursor-pointer transition opacity-60 hover:opacity-100 ${
                      selectedEvent?.id === evt.id ? 'border-primary' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{evt.driver_name}</span>
                      {statusBadge(evt.status)}
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
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
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

          {/* Selected Event Details Panel */}
          {selectedEvent && (
            <div className="absolute bottom-4 left-4 right-4 glass-card rounded-xl p-4 max-w-lg max-h-[60%] overflow-y-auto">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{selectedEvent.driver_name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedEvent.driver_email}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-muted-foreground hover:text-foreground text-xl"
                >
                  ×
                </button>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">{hazardEmoji(selectedEvent.hazard)}</span>
                <span className="font-medium">{selectedEvent.hazard.toUpperCase()}</span>
                {statusBadge(selectedEvent.status)}
              </div>

              <div className="text-xs text-muted-foreground mb-3 flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(selectedEvent.created_at).toLocaleString()}
                </span>
                {selectedEvent.latitude && selectedEvent.longitude && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedEvent.latitude.toFixed(4)}, {selectedEvent.longitude.toFixed(4)}
                  </span>
                )}
              </div>

              {selectedEvent.message && (
                <div className="p-2 bg-muted rounded-lg mb-3">
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
                    className="w-full max-h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
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
    </div>
  );
}
