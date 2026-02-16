import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleMap, useJsApiLoader, Polyline, InfoWindow } from '@react-google-maps/api';
import AdvancedMarker from '@/components/map/AdvancedMarker';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';
import { AlertTriangle, CheckCircle, Clock, MapPin, Image, Calendar, ZoomIn, Map, Satellite, Trash2, ExternalLink, X, Navigation } from 'lucide-react';
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
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${color}" stroke="white" stroke-width="${strokeWidth}"/>
      <text x="${size / 2}" y="${size / 2 + fontSize / 3}" font-family="Arial,sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle">${index}</text>
      ${isSelected ? `
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="none" stroke="${color}" stroke-width="2" opacity="0.6">
          <animate attributeName="r" from="${size / 2}" to="${size / 2 + 8}" dur="1.2s" repeatCount="indefinite"/>
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

  const selectAndZoom = useCallback((evt: SOSEvent) => {
    setSelectedEvent(evt);
    if (mapRef.current && evt.latitude && evt.longitude) {
      mapRef.current.panTo({ lat: evt.latitude, lng: evt.longitude });
      mapRef.current.setZoom(16);
    }
  }, []);

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
    return <Badge variant={variants[status] || 'outline'} className="text-[10px] px-1.5 py-0">{status.toUpperCase()}</Badge>;
  };

  const hazardIcon = (hazard: string) => {
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
    <div className="h-[calc(100dvh-140px)] flex flex-col gap-2">
      {/* Header Row */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg sm:text-xl font-bold">Incidents</h1>
          {activeEvents.length > 0 && (
            <Badge variant="destructive" className="text-[10px] px-2 py-0.5 animate-pulse">
              {activeEvents.length} Active
            </Badge>
          )}
        </div>
        {/* Map type & controls */}
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={mapType === 'roadmap' ? 'default' : 'outline'}
            onClick={() => setMapType('roadmap')}
            className="h-7 px-2 text-[10px]"
          >
            <Map className="h-3 w-3 mr-1" /> Map
          </Button>
          <Button
            size="sm"
            variant={mapType === 'satellite' ? 'default' : 'outline'}
            onClick={() => setMapType('satellite')}
            className="h-7 px-2 text-[10px]"
          >
            <Satellite className="h-3 w-3 mr-1" /> Satellite
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:grid lg:grid-cols-[300px_1fr_320px] gap-2 min-h-0">

        {/* Left Panel - Incident List */}
        <div className="order-2 lg:order-1 rounded-xl border border-border bg-card overflow-y-auto min-h-[100px] max-h-[28vh] lg:max-h-none">
          {/* Active Section */}
          <div className="p-2.5">
            <h2 className="font-semibold text-xs flex items-center gap-1.5 mb-2 text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              Active ({activeEvents.length})
            </h2>
            {loading ? (
              <p className="text-[10px] text-muted-foreground py-4 text-center">Loading...</p>
            ) : activeEvents.length === 0 ? (
              <p className="text-[10px] text-muted-foreground py-4 text-center">No active incidents</p>
            ) : (
              <div className="space-y-1.5">
                {activeEvents.map((evt) => {
                  const markerNum = eventIndexMap[evt.id];
                  const isSelected = selectedEvent?.id === evt.id;
                  return (
                    <button
                      key={evt.id}
                      onClick={() => selectAndZoom(evt)}
                      className={`w-full text-left p-2 rounded-lg border transition-all ${
                        isSelected
                          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {markerNum && (
                          <span className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white ${
                            evt.status === 'open' ? 'bg-destructive' : 'bg-yellow-500'
                          }`}>
                            {markerNum}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold truncate">{evt.driver_name}</span>
                            {statusBadge(evt.status)}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] uppercase text-muted-foreground font-medium">{hazardIcon(evt.hazard)} {evt.hazard}</span>
                            <span className="text-[9px] text-muted-foreground">·</span>
                            <span className="text-[9px] text-muted-foreground">{formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Resolved Section */}
          {resolvedEvents.length > 0 && (
            <div className="p-2.5 border-t border-border">
              <h2 className="font-semibold text-xs flex items-center gap-1.5 mb-2 text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5" />
                Resolved ({resolvedEvents.length})
              </h2>
              <div className="space-y-1">
                {resolvedEvents.slice(0, 10).map((evt) => {
                  const markerNum = eventIndexMap[evt.id];
                  const isSelected = selectedEvent?.id === evt.id;
                  return (
                    <div
                      key={evt.id}
                      onClick={() => selectAndZoom(evt)}
                      className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition opacity-60 hover:opacity-100 ${
                        isSelected ? 'border-primary bg-primary/5 opacity-100' : 'border-transparent hover:border-border'
                      }`}
                    >
                      {markerNum && (
                        <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold text-white bg-green-500">
                          {markerNum}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <span className="text-[11px] font-medium truncate block">{evt.driver_name}</span>
                        <span className="text-[9px] text-muted-foreground">{formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {statusBadge(evt.status)}
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(evt.id); }}
                          className="p-0.5 text-muted-foreground hover:text-destructive transition"
                          title="Delete"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Center - Clean Map (no overlays) */}
        <div className="order-1 lg:order-2 rounded-xl overflow-hidden border border-border h-[50vh] sm:h-[55vh] lg:h-full min-h-[350px]">
          {!isLoaded ? (
            <div className="flex items-center justify-center h-full bg-muted/20">
              <p className="text-muted-foreground text-sm">Loading map...</p>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: 9.0820, lng: 8.6753 }}
              zoom={6}
              onLoad={(map) => {
                mapRef.current = map;
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
              {events
                .filter((e) => e.latitude && e.longitude)
                .map((evt) => {
                  const markerNum = eventIndexMap[evt.id] || 0;
                  const isSelected = selectedEvent?.id === evt.id;
                  return (
                    <AdvancedMarker
                      key={evt.id}
                      position={{ lat: evt.latitude!, lng: evt.longitude! }}
                      onClick={() => selectAndZoom(evt)}
                      iconUrl={createSOSMarkerIcon(markerNum, evt.status, isSelected)}
                      iconSize={isSelected ? 44 : 32}
                      zIndex={isSelected ? 1000 : 100}
                      opacity={selectedEvent && !isSelected ? 0.4 : 1}
                    />
                  );
                })}

              {positionTrail.length > 1 && (
                <Polyline
                  path={positionTrail.map(p => ({ lat: p.latitude, lng: p.longitude }))}
                  options={{ strokeColor: '#3b82f6', strokeOpacity: 0.8, strokeWeight: 3, geodesic: true }}
                />
              )}

              {positionTrail.map((pos, idx) => (
                <AdvancedMarker
                  key={pos.id}
                  position={{ lat: pos.latitude, lng: pos.longitude }}
                  iconSize={12}
                  title={`Update ${idx + 1}: ${new Date(pos.timestamp).toLocaleTimeString()}`}
                >
                  <div className="w-[10px] h-[10px] rounded-full bg-blue-500/60 border border-white" />
                </AdvancedMarker>
              ))}
            </GoogleMap>
          )}
        </div>

        {/* Right Panel - Incident Details (outside the map) */}
        <div className="order-3 rounded-xl border border-border bg-card overflow-y-auto min-h-[100px] max-h-[35vh] lg:max-h-none">
          {selectedEvent ? (
            <div className="p-3">
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  {eventIndexMap[selectedEvent.id] && (
                    <span className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold text-white ${
                      selectedEvent.status === 'open' ? 'bg-destructive' : selectedEvent.status === 'acknowledged' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}>
                      {eventIndexMap[selectedEvent.id]}
                    </span>
                  )}
                  <div>
                    <h3 className="font-bold text-sm">{selectedEvent.driver_name}</h3>
                    {selectedEvent.driver_code && (
                      <p className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded inline-block mt-0.5">
                        {selectedEvent.driver_code}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="p-1 rounded-md hover:bg-muted transition text-muted-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Status & Hazard */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">{hazardIcon(selectedEvent.hazard)}</span>
                <span className="font-semibold text-xs uppercase">{selectedEvent.hazard}</span>
                {statusBadge(selectedEvent.status)}
              </div>

              {/* Meta Info */}
              <div className="space-y-1 mb-3 p-2 rounded-lg bg-muted/50 border border-border">
                <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 shrink-0" />
                  {new Date(selectedEvent.created_at).toLocaleString()}
                </p>
                {selectedEvent.latitude && selectedEvent.longitude && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {selectedEvent.latitude.toFixed(4)}, {selectedEvent.longitude.toFixed(4)}
                  </p>
                )}
                {positionTrail.length > 0 && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Navigation className="h-3 w-3 shrink-0" />
                    {positionTrail.length} position update{positionTrail.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>

              {/* Quick Actions */}
              {selectedEvent.latitude && selectedEvent.longitude && (
                <div className="flex gap-1.5 mb-3">
                  <Button size="sm" variant="outline" onClick={zoomToLocation} className="flex-1 h-8 text-[11px]">
                    <ZoomIn className="h-3 w-3 mr-1" /> Zoom
                  </Button>
                  <Button size="sm" variant="outline" onClick={openInGoogleMaps} className="flex-1 h-8 text-[11px]">
                    <ExternalLink className="h-3 w-3 mr-1" /> Google Maps
                  </Button>
                </div>
              )}

              {/* Message */}
              {selectedEvent.message && (
                <div className="p-2 bg-muted/50 rounded-lg mb-3 border border-border">
                  <p className="text-[11px] text-foreground">{selectedEvent.message}</p>
                </div>
              )}

              {/* Photo Evidence */}
              {selectedEvent.photo_url && (
                <div className="mb-3">
                  <p className="text-xs font-medium mb-1.5 flex items-center gap-1">
                    <Image className="h-3 w-3" /> Photo Evidence
                  </p>
                  <img
                    src={selectedEvent.photo_url}
                    alt="Evidence"
                    className="w-full h-36 object-cover rounded-lg cursor-pointer hover:opacity-90 transition border border-border"
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

              {/* Action Buttons */}
              {selectedEvent.status === 'open' && (
                <Button size="sm" onClick={() => acknowledgeEvent(selectedEvent.id)} className="w-full h-8 text-xs">
                  <Clock className="h-3.5 w-3.5 mr-1.5" /> Acknowledge
                </Button>
              )}

              {selectedEvent.status === 'acknowledged' && (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Resolution note..."
                    value={resolveNote}
                    onChange={(e) => setResolveNote(e.target.value)}
                    rows={2}
                    className="text-xs min-h-[50px]"
                  />
                  <Button size="sm" onClick={() => resolveEvent(selectedEvent.id)} className="w-full h-8 text-xs">
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Resolve
                  </Button>
                </div>
              )}

              {selectedEvent.resolved_note && (
                <div className="mt-3 p-2 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-[11px] font-medium text-green-600 dark:text-green-400">✓ {selectedEvent.resolved_note}</p>
                </div>
              )}

              {(selectedEvent.status === 'resolved' || selectedEvent.status === 'cancelled') && (
                <Button size="sm" variant="destructive" onClick={() => handleDeleteClick(selectedEvent.id)} className="w-full mt-3 h-8 text-xs">
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Incident
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <MapPin className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">No incident selected</p>
              <p className="text-[11px] text-muted-foreground/70 mt-1">Select an incident from the list to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Photo Modal */}
      {photoModalOpen && selectedEvent?.photo_url && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPhotoModalOpen(false)}>
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={selectedEvent.photo_url} alt="Evidence" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            <button onClick={() => setPhotoModalOpen(false)} className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition">
              <X className="h-4 w-4" />
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
            <AlertDialogAction onClick={() => eventToDelete && deleteEvent(eventToDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
