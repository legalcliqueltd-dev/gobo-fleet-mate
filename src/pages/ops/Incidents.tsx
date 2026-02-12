import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleMap, Marker, useJsApiLoader, Polyline, InfoWindow } from '@react-google-maps/api';
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
  user_id: string | null;
  driver_id?: string | null;
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

// Create numbered SOS marker icon
const createSOSMarkerIcon = (index: number, status: string, isSelected: boolean) => {
  const colors: Record<string, string> = {
    open: '#ef4444',
    acknowledged: '#eab308',
    resolved: '#22c55e',
  };
  const color = colors[status] || '#6b7280';
  const size = isSelected ? 44 : 32;
  const fontSize = isSelected ? 16 : 12;
  const strokeWidth = isSelected ? 3 : 2;
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="white" stroke-width="${strokeWidth}"/>
      <text x="${size/2}" y="${size/2 + fontSize/3}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle">${index}</text>
      ${isSelected ? `
        <circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
          <animate attributeName="r" from="${size/2}" to="${size/2 + 8}" dur="1.2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" from="0.6" to="0" dur="1.2s" repeatCount="indefinite"/>
        </circle>
      ` : ''}
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
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
  const hasFittedInitialBounds = useRef(false);

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
      // Zoom to selected event
      if (mapRef.current && selectedEvent.latitude && selectedEvent.longitude) {
        mapRef.current.panTo({ lat: selectedEvent.latitude, lng: selectedEvent.longitude });
        mapRef.current.setZoom(16);
      }
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

      // Fit map bounds to all events with locations on initial load
      if (!hasFittedInitialBounds.current && mapRef.current) {
        const eventsWithLoc = enrichedEvents.filter(e => e.latitude && e.longitude);
        if (eventsWithLoc.length > 0) {
          const bounds = new google.maps.LatLngBounds();
          eventsWithLoc.forEach(e => bounds.extend({ lat: e.latitude!, lng: e.longitude! }));
          mapRef.current.fitBounds(bounds, 60);
          hasFittedInitialBounds.current = true;
        }
      }

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
        { event: '*', schema: 'public', table: 'sos_events' },
        () => { loadEvents(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_position_updates' },
        (payload) => {
          if (selectedEvent && payload.new.sos_event_id === selectedEvent.id) {
            setPositionTrail(prev => [...prev, payload.new as PositionUpdate]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  };

  const acknowledgeEvent = async (eventId: string) => {
    if (!user || !isAdmin) return;
    const { error } = await supabase
      .from('sos_events')
      .update({ status: 'acknowledged', acknowledged_by: user.id, acknowledged_at: new Date().toISOString() })
      .eq('id', eventId);

    if (!error) { toast.success('SOS acknowledged'); loadEvents(); }
    else { toast.error('Failed to acknowledge'); }
  };

  const resolveEvent = async (eventId: string) => {
    if (!user || !isAdmin) return;
    const { error } = await supabase
      .from('sos_events')
      .update({ status: 'resolved', resolved_by: user.id, resolved_at: new Date().toISOString(), resolved_note: resolveNote || null })
      .eq('id', eventId);

    if (!error) { toast.success('SOS resolved'); setResolveNote(''); setSelectedEvent(null); loadEvents(); }
    else { toast.error('Failed to resolve'); }
  };

  const deleteEvent = async (eventId: string) => {
    const { error } = await supabase.from('sos_events').delete().eq('id', eventId);
    if (!error) {
      toast.success('SOS event deleted');
      if (selectedEvent?.id === eventId) setSelectedEvent(null);
      loadEvents();
    } else { toast.error('Failed to delete event'); }
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
      window.open(`https://www.google.com/maps?q=${selectedEvent.latitude},${selectedEvent.longitude}`, '_blank');
    }
  }, [selectedEvent]);

  // Get the index for each event (for numbered markers)
  const eventIndexMap = useMemo(() => {
    const indexMap: Record<string, number> = {};
    const eventsWithLoc = events.filter(e => e.latitude && e.longitude);
    eventsWithLoc.forEach((e, idx) => { indexMap[e.id] = idx + 1; });
    return indexMap;
  }, [events]);

  const statusBadge = (status: string) => {
    const variants: Record<string, 'destructive' | 'default' | 'secondary' | 'outline'> = {
      open: 'destructive',
      acknowledged: 'default',
      resolved: 'secondary',
      cancelled: 'outline',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.toUpperCase()}</Badge>;
  };

  const hazardEmoji = (hazard: string) => {
    const emojis: Record<string, string> = {
      accident: '🚗', medical: '🏥', robbery: '🚨', breakdown: '🔧', other: '⚠️',
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
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">Incident Management</h1>
          <Badge variant={activeEvents.length > 0 ? 'destructive' : 'secondary'} className="text-xs sm:text-sm px-2 sm:px-3 py-0.5 sm:py-1">
            {activeEvents.length} Active
          </Badge>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[320px_1fr] xl:grid-cols-[360px_1fr] gap-3 min-h-0">
        {/* Events List */}
        <div className="order-2 lg:order-1 glass-card rounded-xl p-3 overflow-y-auto flex-1 lg:flex-none lg:max-h-full min-h-[120px] max-h-[30vh] lg:max-h-none">
          <h2 className="font-semibold mb-2 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Active ({activeEvents.length})
          </h2>
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : activeEvents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active incidents</p>
          ) : (
            <div className="space-y-2">
              {activeEvents.map((evt) => {
                const markerNum = eventIndexMap[evt.id];
                return (
                  <div
                    key={evt.id}
                    onClick={() => setSelectedEvent(evt)}
                    className={`p-2.5 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedEvent?.id === evt.id
                        ? 'border-primary bg-primary/5 shadow-lg'
                        : 'border-border hover:border-primary/50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {/* Marker number badge */}
                        {markerNum && (
                          <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white ${
                            evt.status === 'open' ? 'bg-destructive' : 'bg-yellow-500'
                          }`}>
                            {markerNum}
                          </span>
                        )}
                        <span className="text-lg">{hazardEmoji(evt.hazard)}</span>
                        <div>
                          <p className="font-semibold text-sm">{evt.driver_name}</p>
                          {evt.driver_code && (
                            <p className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded inline-block mt-0.5">
                              {evt.driver_code}
                            </p>
                          )}
                        </div>
                      </div>
                      {statusBadge(evt.status)}
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase font-medium mb-0.5">{evt.hazard}</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}
                    </p>
                    {evt.photo_url && (
                      <div className="mt-1.5">
                        <img src={evt.photo_url} alt="Evidence" className="w-full h-14 object-cover rounded-lg border border-border" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {resolvedEvents.length > 0 && (
            <>
              <h2 className="font-semibold mt-4 mb-2 flex items-center gap-2 text-muted-foreground text-sm">
                <CheckCircle className="h-4 w-4" />
                Resolved ({resolvedEvents.length})
              </h2>
              <div className="space-y-1.5">
                {resolvedEvents.slice(0, 10).map((evt) => {
                  const markerNum = eventIndexMap[evt.id];
                  return (
                    <div
                      key={evt.id}
                      onClick={() => setSelectedEvent(evt)}
                      className={`p-2 rounded-lg border cursor-pointer transition opacity-70 hover:opacity-100 flex items-center justify-between ${
                        selectedEvent?.id === evt.id ? 'border-primary bg-primary/5' : 'border-border'
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        {markerNum && (
                          <span className="flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white bg-green-500 shrink-0">
                            {markerNum}
                          </span>
                        )}
                        <div className="min-w-0">
                          <span className="text-xs font-medium truncate block">{evt.driver_name}</span>
                          {evt.driver_code && (
                            <span className="text-[10px] font-mono bg-muted px-1 py-0.5 rounded inline-block mt-0.5">
                              {evt.driver_code}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        {statusBadge(evt.status)}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(evt.id); }}
                          className="p-1 text-muted-foreground hover:text-destructive transition"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Map */}
        <div className="order-1 lg:order-2 glass-card rounded-xl overflow-hidden relative h-[55vh] sm:h-[60vh] lg:h-full min-h-[400px]">
          {!isLoaded ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: 9.0820, lng: 8.6753 }}
              zoom={6}
              onLoad={(map) => {
                mapRef.current = map;
                // Fit bounds if we already have events
                const eventsWithLoc = events.filter(e => e.latitude && e.longitude);
                if (eventsWithLoc.length > 0 && !hasFittedInitialBounds.current) {
                  const bounds = new google.maps.LatLngBounds();
                  eventsWithLoc.forEach(e => bounds.extend({ lat: e.latitude!, lng: e.longitude! }));
                  map.fitBounds(bounds, 60);
                  hasFittedInitialBounds.current = true;
                }
              }}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
                mapTypeId: mapType,
                gestureHandling: 'greedy',
              }}
            >
              {/* SOS Event Markers - numbered, selected one pulses */}
              {events
                .filter((e) => e.latitude && e.longitude)
                .map((evt) => {
                  const markerNum = eventIndexMap[evt.id] || 0;
                  const isSelected = selectedEvent?.id === evt.id;
                  return (
                    <Marker
                      key={evt.id}
                      position={{ lat: evt.latitude!, lng: evt.longitude! }}
                      onClick={() => setSelectedEvent(evt)}
                      icon={{
                        url: createSOSMarkerIcon(markerNum, evt.status, isSelected),
                        anchor: isSelected ? new google.maps.Point(22, 22) : new google.maps.Point(16, 16),
                        scaledSize: isSelected ? new google.maps.Size(44, 44) : new google.maps.Size(32, 32),
                      }}
                      zIndex={isSelected ? 1000 : 100}
                      opacity={selectedEvent && !isSelected ? 0.4 : 1}
                    />
                  );
                })}

              {/* Selected event info window */}
              {selectedEvent && selectedEvent.latitude && selectedEvent.longitude && (
                <InfoWindow
                  position={{ lat: selectedEvent.latitude, lng: selectedEvent.longitude }}
                  onCloseClick={() => {}}
                >
                  <div className="p-1 min-w-[120px]">
                    <p className="font-bold text-xs text-gray-900">{hazardEmoji(selectedEvent.hazard)} {selectedEvent.hazard.toUpperCase()}</p>
                    <p className="text-[11px] text-gray-600">{selectedEvent.driver_name}</p>
                    <p className="text-[10px] text-gray-500">{new Date(selectedEvent.created_at).toLocaleString()}</p>
                  </div>
                </InfoWindow>
              )}

              {/* Position Trail Polyline */}
              {positionTrail.length > 1 && (
                <Polyline
                  path={positionTrail.map(p => ({ lat: p.latitude, lng: p.longitude }))}
                  options={{ strokeColor: '#3b82f6', strokeOpacity: 0.8, strokeWeight: 3, geodesic: true }}
                />
              )}

              {/* Position Trail Markers */}
              {positionTrail.map((pos, idx) => (
                <Marker
                  key={pos.id}
                  position={{ lat: pos.latitude, lng: pos.longitude }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 5,
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
          <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex gap-1.5">
            <Button size="sm" variant={mapType === 'roadmap' ? 'default' : 'secondary'} onClick={() => setMapType('roadmap')} className="shadow-lg h-7 px-2 text-xs">
              <Map className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Map</span>
            </Button>
            <Button size="sm" variant={mapType === 'satellite' ? 'default' : 'secondary'} onClick={() => setMapType('satellite')} className="shadow-lg h-7 px-2 text-xs">
              <Satellite className="h-3.5 w-3.5 sm:mr-1" />
              <span className="hidden sm:inline">Satellite</span>
            </Button>
          </div>

          {/* Selected Event Details Panel */}
          {selectedEvent && (
            <div className="absolute 
              bottom-2 left-2 right-2 max-h-[45%]
              lg:bottom-auto lg:left-auto lg:top-12 lg:right-3 lg:w-72 xl:w-80 lg:max-h-[calc(100%-4rem)]
              glass-card rounded-xl p-2.5 overflow-y-auto shadow-2xl border border-border/50
            ">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {/* Marker number */}
                  {eventIndexMap[selectedEvent.id] && (
                    <span className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold text-white ${
                      selectedEvent.status === 'open' ? 'bg-destructive' : selectedEvent.status === 'acknowledged' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}>
                      {eventIndexMap[selectedEvent.id]}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold text-xs truncate">{selectedEvent.driver_name}</h3>
                    {selectedEvent.driver_code && (
                      <p className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded inline-block">
                        {selectedEvent.driver_code}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-muted-foreground hover:text-foreground text-lg font-light shrink-0 p-1">×</button>
              </div>

              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-lg">{hazardEmoji(selectedEvent.hazard)}</span>
                <span className="font-semibold text-xs">{selectedEvent.hazard.toUpperCase()}</span>
                {statusBadge(selectedEvent.status)}
              </div>

              <div className="text-[10px] text-muted-foreground mb-2 space-y-0.5">
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

              {selectedEvent.latitude && selectedEvent.longitude && (
                <div className="flex gap-1.5 mb-2">
                  <Button size="sm" variant="outline" onClick={zoomToLocation} className="flex-1 h-7 text-[10px]">
                    <ZoomIn className="h-3 w-3 mr-1" /> Zoom
                  </Button>
                  <Button size="sm" variant="outline" onClick={openInGoogleMaps} className="flex-1 h-7 text-[10px]">
                    <ExternalLink className="h-3 w-3 mr-1" /> Google Maps
                  </Button>
                </div>
              )}

              {selectedEvent.message && (
                <div className="p-1.5 bg-muted rounded-lg mb-2">
                  <p className="text-[10px]">{selectedEvent.message}</p>
                </div>
              )}

              {selectedEvent.photo_url && (
                <div className="mb-2">
                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                    <Image className="h-3 w-3" /> Photo Evidence
                  </p>
                  <img
                    src={selectedEvent.photo_url}
                    alt="Evidence"
                    className="w-full max-h-32 object-cover rounded-lg cursor-pointer hover:opacity-90 transition border border-border"
                    onClick={() => setPhotoModalOpen(true)}
                    onError={(e) => {
                      const target = e.currentTarget;
                      target.style.display = 'none';
                      const fallback = document.createElement('p');
                      fallback.className = 'text-xs text-muted-foreground italic';
                      fallback.textContent = 'Image unavailable';
                      target.parentElement?.appendChild(fallback);
                    }}
                  />
                </div>
              )}

              {positionTrail.length > 0 && (
                <p className="text-[10px] text-muted-foreground mb-2">
                  📍 {positionTrail.length} position update{positionTrail.length > 1 ? 's' : ''}
                </p>
              )}

              {selectedEvent.status === 'open' && (
                <Button size="sm" onClick={() => acknowledgeEvent(selectedEvent.id)} className="w-full mb-1.5 h-7 text-[10px]">
                  <Clock className="h-3 w-3 mr-1" /> Acknowledge
                </Button>
              )}

              {selectedEvent.status === 'acknowledged' && (
                <div className="space-y-1.5">
                  <Textarea placeholder="Resolution note..." value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} rows={2} className="text-[10px] min-h-[50px]" />
                  <Button size="sm" onClick={() => resolveEvent(selectedEvent.id)} className="w-full h-7 text-[10px]">
                    <CheckCircle className="h-3 w-3 mr-1" /> Resolve
                  </Button>
                </div>
              )}

              {selectedEvent.resolved_note && (
                <div className="mt-2 p-1.5 bg-green-500/10 rounded-lg">
                  <p className="text-[10px] font-medium text-green-600 dark:text-green-400">✓ {selectedEvent.resolved_note}</p>
                </div>
              )}

              {(selectedEvent.status === 'resolved' || selectedEvent.status === 'cancelled') && (
                <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(selectedEvent.id)} className="w-full mt-2 h-7 text-[10px]">
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Photo Modal */}
      {photoModalOpen && selectedEvent?.photo_url && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPhotoModalOpen(false)}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={selectedEvent.photo_url} alt="Evidence" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <button onClick={() => setPhotoModalOpen(false)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition">×</button>
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
            <AlertDialogAction onClick={() => eventToDelete && deleteEvent(eventToDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
