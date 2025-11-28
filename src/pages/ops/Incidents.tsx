import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '../../contexts/AuthContext';
import { GoogleMap, Marker, useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../../lib/googleMapsConfig';
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import { Badge } from '../../components/ui/badge';

type SOSEvent = {
  id: string;
  user_id: string;
  device_id: string | null;
  hazard: string;
  message: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolved_note: string | null;
  status: string;
};

export default function Incidents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SOSEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<SOSEvent | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  useEffect(() => {
    checkAdmin();
    loadEvents();
    subscribeToEvents();
  }, []);

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
    const { data, error } = await supabase
      .from('sos_events')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setEvents(data);
      if (data.length > 0 && data[0].status === 'open') {
        setSelectedEvent(data[0]);
      }
    }
    setLoading(false);
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
      loadEvents();
    } else {
      toast.error('Failed to resolve');
    }
  };

  const centerLocation = useMemo(() => {
    if (selectedEvent && selectedEvent.latitude && selectedEvent.longitude) {
      return { latitude: selectedEvent.latitude, longitude: selectedEvent.longitude, zoom: 13 };
    }
    const openEvents = events.filter((e) => e.status === 'open' && e.latitude && e.longitude);
    if (openEvents.length > 0) {
      return { latitude: openEvents[0].latitude!, longitude: openEvents[0].longitude!, zoom: 10 };
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

  return (
    <div className="h-[calc(100vh-200px)]">
      <h1 className="text-3xl font-bold mb-4">Incident Management</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
        {/* Events List */}
        <div className="glass-card rounded-xl p-4 overflow-y-auto">
          <h2 className="font-semibold mb-3">Active Incidents ({events.filter((e) => e.status !== 'resolved').length})</h2>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-muted-foreground">No incidents</p>
          ) : (
            <div className="space-y-2">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  onClick={() => setSelectedEvent(evt)}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selectedEvent?.id === evt.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      <span className="font-medium text-sm">{evt.hazard.toUpperCase()}</span>
                    </div>
                    {statusBadge(evt.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(evt.created_at).toLocaleString()}
                  </p>
                  {evt.message && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{evt.message}</p>
                  )}
                </div>
              ))}
            </div>
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
              {events
                .filter((e) => e.latitude && e.longitude)
                .map((evt) => (
                  <Marker
                    key={evt.id}
                    position={{ lat: evt.latitude!, lng: evt.longitude! }}
                    onClick={() => setSelectedEvent(evt)}
                    icon={{
                      path: window.google.maps.SymbolPath.CIRCLE,
                      scale: 16,
                      fillColor: evt.status === 'open' ? '#ef4444' : evt.status === 'acknowledged' ? '#eab308' : '#22c55e',
                      fillOpacity: 1,
                      strokeColor: '#ffffff',
                      strokeWeight: 2,
                    }}
                  />
                ))}
            </GoogleMap>
          )}

          {/* Selected Event Details */}
          {selectedEvent && (
            <div className="absolute bottom-4 left-4 right-4 glass-card rounded-lg p-4 max-w-md">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold">
                  {selectedEvent.hazard.toUpperCase()} - {statusBadge(selectedEvent.status)}
                </h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-muted-foreground mb-2">
                Created: {new Date(selectedEvent.created_at).toLocaleString()}
              </p>

              {selectedEvent.message && (
                <p className="text-sm mb-3 p-2 bg-muted rounded">{selectedEvent.message}</p>
              )}

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
                <div className="mt-2 p-2 bg-green-500/10 rounded">
                  <p className="text-xs font-medium text-green-600 dark:text-green-400">
                    Resolved: {selectedEvent.resolved_note}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
