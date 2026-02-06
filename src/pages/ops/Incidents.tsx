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
  user_id: string | null; // auth user UUID (nullable for code-based drivers)
  driver_id?: string | null; // code-based driver ID
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

const isUuid = (value: string | null | undefined) =>
  !!value &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

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
        rawEvents.map(async (event: any) => {
          const driverLookupId: string | null = event.driver_id || event.user_id || null;

          if (driverLookupId) {
            const { data: driver } = await supabase
              .from('drivers')
              .select('driver_id, driver_name, admin_code')
              .eq('driver_id', driverLookupId)
              .single();

            if (driver) {
              return {
                ...event,
                driver_name: driver.driver_name || 'Unknown Driver',
                driver_code: driver.admin_code,
                driver_email: '',
              } as SOSEvent;
            }
          }

          if (isUuid(event.user_id)) {
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
            } as SOSEvent;
          }

          return {
            ...event,
            driver_name: 'Unknown Driver',
            driver_email: '',
            driver_code: event.admin_code || '',
          } as SOSEvent;
        })
      );

      setEvents(enrichedEvents);

      // Auto-select first open event
      const firstOpen = enrichedEvents.find((e) => e.status === 'open');
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
    <div className="h-[calc(100dvh-140px)] flex flex-col">
      <div className="flex items-center justify-between mb-3 sm:mb-4 px-1">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Incident Management</h1>
          <Badge variant={activeEvents.length > 0 ? 'destructive' : 'secondary'} className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">
            {activeEvents.length} Active
          </Badge>
        </div>
      </div>

      {/* Mobile: Map first, then list. Desktop: Side-by-side */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-3 gap-3 sm:gap-4 min-h-0">
        {/* Map - Full width on mobile, 2 cols on desktop */}
        <div className="order-1 lg:order-2 lg:col-span-2 glass-card rounded-xl overflow-hidden relative h-[60vh] sm:h-[65vh] lg:h-full min-h-[350px]">
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

          {/* Map Type Toggle - Responsive */}
          <div className="absolute top-2 right-2 sm:top-4 sm:right-4 flex gap-1.5 sm:gap-2">
            <Button
              size="sm"
              variant={mapType === 'roadmap' ? 'default' : 'secondary'}
              onClick={() => setMapType('roadmap')}
              className="shadow-lg h-7 sm:h-8 px-2 sm:px-3 text-xs"
            >
              <Map className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Map</span>
            </Button>
            <Button
              size="sm"
              variant={mapType === 'satellite' ? 'default' : 'secondary'}
              onClick={() => setMapType('satellite')}
              className="shadow-lg h-7 sm:h-8 px-2 sm:px-3 text-xs"
            >
              <Satellite className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Satellite</span>
            </Button>
          </div>

          {/* Selected Event Details Panel - Bottom sheet on mobile, side drawer on desktop */}
          {selectedEvent && (
            <div className="absolute 
              bottom-2 left-2 right-2 max-h-[45%]
              sm:bottom-4 sm:left-4 sm:right-4 sm:max-h-[50%]
              lg:bottom-auto lg:left-auto lg:top-14 lg:right-4 lg:w-72 xl:w-80 lg:max-h-[calc(100%-4.5rem)]
              glass-card rounded-xl p-2.5 sm:p-3 overflow-y-auto shadow-2xl border border-border/50
            ">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs sm:text-sm truncate">{selectedEvent.driver_name}</h3>
                    {selectedEvent.driver_code && (
                      <p className="text-[10px] sm:text-xs font-mono bg-muted px-1 sm:px-1.5 py-0.5 rounded inline-block">
                        {selectedEvent.driver_code}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-muted-foreground hover:text-foreground text-lg sm:text-xl font-light shrink-0 p-1"
                >
                  ×
                </button>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 mb-2">
                <span className="text-lg sm:text-2xl">{hazardEmoji(selectedEvent.hazard)}</span>
                <span className="font-semibold text-xs sm:text-sm">{selectedEvent.hazard.toUpperCase()}</span>
                {statusBadge(selectedEvent.status)}
              </div>

              <div className="text-[10px] sm:text-xs text-muted-foreground mb-2 space-y-0.5 sm:space-y-1">
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

              {/* Map Action Buttons - Row on mobile, column on desktop */}
              {selectedEvent.latitude && selectedEvent.longitude && (
                <div className="flex flex-row lg:flex-col gap-1.5 mb-2">
                  <Button size="sm" variant="outline" onClick={zoomToLocation} className="flex-1 lg:w-full justify-center lg:justify-start h-7 sm:h-8 text-[10px] sm:text-xs">
                    <ZoomIn className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                    <span className="hidden xs:inline sm:inline">Zoom</span>
                    <span className="xs:hidden sm:hidden">📍</span>
                  </Button>
                  <Button size="sm" variant="outline" onClick={openInGoogleMaps} className="flex-1 lg:w-full justify-center lg:justify-start h-7 sm:h-8 text-[10px] sm:text-xs">
                    <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                    <span className="hidden xs:inline sm:inline">Google Maps</span>
                    <span className="xs:hidden sm:hidden">🗺️</span>
                  </Button>
                </div>
              )}

              {selectedEvent.message && (
                <div className="p-1.5 sm:p-2 bg-muted rounded-lg mb-2">
                  <p className="text-[10px] sm:text-xs">{selectedEvent.message}</p>
                </div>
              )}

              {/* Photo Evidence - Hidden on very small screens, shown on larger */}
              {selectedEvent.photo_url && (
                <div className="mb-2 hidden sm:block">
                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                    <Image className="h-3 w-3" />
                    Photo Evidence
                  </p>
                  <img
                    src={selectedEvent.photo_url}
                    alt="Evidence"
                    className="w-full max-h-24 lg:max-h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition"
                    onClick={() => setPhotoModalOpen(true)}
                  />
                </div>
              )}

              {/* Position Trail Info */}
              {positionTrail.length > 0 && (
                <p className="text-[10px] sm:text-xs text-muted-foreground mb-2">
                  📍 {positionTrail.length} position update{positionTrail.length > 1 ? 's' : ''}
                </p>
              )}

              {/* Action Buttons */}
              {selectedEvent.status === 'open' && (
                <Button
                  size="sm"
                  onClick={() => acknowledgeEvent(selectedEvent.id)}
                  className="w-full mb-1.5 h-7 sm:h-8 text-[10px] sm:text-xs"
                >
                  <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                  Acknowledge
                </Button>
              )}

              {selectedEvent.status === 'acknowledged' && (
                <div className="space-y-1.5">
                  <Textarea
                    placeholder="Resolution note..."
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    rows={2}
                    className="text-[10px] sm:text-xs min-h-[50px]"
                  />
                  <Button
                    size="sm"
                    onClick={() => resolveEvent(selectedEvent.id)}
                    className="w-full h-7 sm:h-8 text-[10px] sm:text-xs"
                    variant="default"
                  >
                    <CheckCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                    Resolve
                  </Button>
                </div>
              )}

              {selectedEvent.resolved_note && (
                <div className="mt-2 p-1.5 sm:p-2 bg-green-500/10 rounded-lg">
                  <p className="text-[10px] sm:text-xs font-medium text-green-600 dark:text-green-400">
                    ✓ {selectedEvent.resolved_note}
                  </p>
                </div>
              )}

              {/* Delete Button for resolved events */}
              {(selectedEvent.status === 'resolved' || selectedEvent.status === 'cancelled') && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteClick(selectedEvent.id)}
                  className="w-full mt-2 h-7 sm:h-8 text-[10px] sm:text-xs"
                >
                  <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                  Delete
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Events List - Below map on mobile, left side on desktop */}
        <div className="order-2 lg:order-1 glass-card rounded-xl p-3 sm:p-4 overflow-y-auto flex-1 lg:flex-none lg:max-h-full min-h-[120px] max-h-[30vh] sm:max-h-[25vh] lg:max-h-none">
          <h2 className="font-semibold mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Active Incidents ({activeEvents.length})
          </h2>
          {loading ? (
            <p className="text-xs sm:text-sm text-muted-foreground">Loading...</p>
          ) : activeEvents.length === 0 ? (
            <p className="text-xs sm:text-sm text-muted-foreground">No active incidents</p>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {activeEvents.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className={`p-2 sm:p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    selectedEvent?.id === evt.id
                      ? 'border-primary bg-primary/5 shadow-lg'
                      : 'border-border hover:border-primary/50 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1 sm:mb-2">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="text-lg sm:text-2xl">{hazardEmoji(evt.hazard)}</span>
                      <div>
                        <p className="font-semibold text-sm sm:text-base">{evt.driver_name}</p>
                        {evt.driver_code && (
                          <p className="text-[10px] sm:text-xs font-mono bg-muted px-1.5 sm:px-2 py-0.5 rounded inline-block mt-0.5">
                            {evt.driver_code}
                          </p>
                        )}
                      </div>
                    </div>
                    {statusBadge(evt.status)}
                  </div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-medium mb-0.5 sm:mb-1">{evt.hazard}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}
                  </p>
                  {evt.photo_url && (
                    <div className="mt-1.5 sm:mt-2 hidden sm:block">
                      <img
                        src={evt.photo_url}
                        alt="Evidence"
                        className="w-full h-12 sm:h-16 object-cover rounded-lg"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {resolvedEvents.length > 0 && (
            <>
              <h2 className="font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 flex items-center gap-2 text-muted-foreground text-sm sm:text-base">
                <CheckCircle className="h-4 w-4" />
                Resolved ({resolvedEvents.length})
              </h2>
              <div className="space-y-1.5 sm:space-y-2">
                {resolvedEvents.slice(0, 10).map((evt) => (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`p-2 sm:p-3 rounded-lg border cursor-pointer transition opacity-70 hover:opacity-100 flex items-center justify-between ${
                      selectedEvent?.id === evt.id ? 'border-primary bg-primary/5' : 'border-border'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-xs sm:text-sm font-medium truncate block">{evt.driver_name}</span>
                      {evt.driver_code && (
                        <span className="text-[10px] sm:text-xs font-mono bg-muted px-1 sm:px-1.5 py-0.5 rounded inline-block mt-0.5">
                          {evt.driver_code}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-2">
                      {statusBadge(evt.status)}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick(evt.id);
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive transition"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
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
