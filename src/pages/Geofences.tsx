import { useState, useRef } from 'react';
import { useGeofences } from '../hooks/useGeofences';
import { useGeofenceEvents } from '../hooks/useGeofenceEvents';
import { GoogleMap, Polygon, Polyline, Circle as GoogleCircle, useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../lib/googleMapsConfig';
import { Plus, MapPin, Circle, Trash2, Eye, EyeOff, Bell, Check, X, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { toast } from 'sonner';

type DrawMode = 'none' | 'circle' | 'polygon';

export default function Geofences() {
  const { geofences, loading, createGeofence, updateGeofence, deleteGeofence } = useGeofences();
  const { events, unacknowledgedCount, acknowledgeEvent } = useGeofenceEvents(20);
  
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [circleCenter, setCircleCenter] = useState<[number, number] | null>(null);
  const [circleRadius, setCircleRadius] = useState(500);
  const [polygonPoints, setPolygonPoints] = useState<[number, number][]>([]);
  const [showEvents, setShowEvents] = useState(false);
  
  const mapRef = useRef<google.maps.Map | null>(null);
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const handleMapClick = (e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    
    if (drawMode === 'circle') {
      setCircleCenter([lng, lat]);
    } else if (drawMode === 'polygon') {
      setPolygonPoints([...polygonPoints, [lng, lat]]);
    }
  };

  const saveCircleGeofence = async () => {
    if (!circleCenter) return;
    
    const name = prompt('Enter geofence name:');
    if (!name) return;

    try {
      await createGeofence({
        name,
        description: `Circle geofence with ${circleRadius}m radius`,
        type: 'circle',
        center_lat: circleCenter[1],
        center_lng: circleCenter[0],
        radius_meters: circleRadius,
        geometry: {},
        active: true,
      });
      
      toast.success('Geofence created successfully');
      setDrawMode('none');
      setCircleCenter(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const savePolygonGeofence = async () => {
    if (polygonPoints.length < 3) {
      toast.error('Polygon must have at least 3 points');
      return;
    }

    const name = prompt('Enter geofence name:');
    if (!name) return;

    try {
      const closedPolygon = [...polygonPoints, polygonPoints[0]];
      
      await createGeofence({
        name,
        description: `Polygon geofence with ${polygonPoints.length} points`,
        type: 'polygon',
        center_lat: null,
        center_lng: null,
        radius_meters: null,
        geometry: closedPolygon,
        active: true,
      });
      
      toast.success('Geofence created successfully');
      setDrawMode('none');
      setPolygonPoints([]);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const cancelDrawing = () => {
    setDrawMode('none');
    setCircleCenter(null);
    setPolygonPoints([]);
  };

  const toggleGeofence = async (id: string, active: boolean) => {
    try {
      await updateGeofence(id, { active: !active });
      toast.success(`Geofence ${!active ? 'activated' : 'deactivated'}`);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this geofence?')) return;
    try {
      await deleteGeofence(id);
      toast.success('Geofence deleted');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeEvent(id);
      toast.success('Event acknowledged');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Geofences</h1>
          <p className="text-muted-foreground mt-1">Create zones and receive alerts when devices enter or exit</p>
        </div>
        <Button onClick={() => setShowEvents(!showEvents)} variant="outline" className="relative border-2">
          <Bell className="h-4 w-4 mr-2" />
          Alerts
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
              {unacknowledgedCount}
            </span>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Drawing tools */}
          <Card className="bg-gradient-to-br from-card to-muted/30 border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Create Geofence
              </CardTitle>
            </CardHeader>
            <CardContent>
              {drawMode === 'none' ? (
                <div className="space-y-3">
                  <Button onClick={() => setDrawMode('circle')} className="w-full justify-start" variant="outline" size="lg">
                    <Circle className="h-5 w-5 mr-3 text-primary" />
                    Draw Circle
                  </Button>
                  <Button onClick={() => setDrawMode('polygon')} className="w-full justify-start" variant="outline" size="lg">
                    <MapPin className="h-5 w-5 mr-3 text-primary" />
                    Draw Polygon
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {drawMode === 'circle' && (
                    <>
                      <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                        {!circleCenter ? '👆 Click on map to set center' : '📐 Adjust radius and save'}
                      </div>
                      {circleCenter && (
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Radius: {circleRadius}m</label>
                          <input
                            type="range"
                            min="100"
                            max="5000"
                            step="100"
                            value={circleRadius}
                            onChange={(e) => setCircleRadius(Number(e.target.value))}
                            className="w-full accent-primary"
                          />
                        </div>
                      )}
                    </>
                  )}
                  
                  {drawMode === 'polygon' && (
                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                      👆 Click on map to add points ({polygonPoints.length} points)
                      {polygonPoints.length >= 3 && ' ✓ Ready to save'}
                    </div>
                  )}
                  
                  <div className="flex gap-2">
                    {((drawMode === 'circle' && circleCenter) || (drawMode === 'polygon' && polygonPoints.length >= 3)) && (
                      <Button onClick={drawMode === 'circle' ? saveCircleGeofence : savePolygonGeofence} className="flex-1">
                        <Check className="h-4 w-4 mr-2" />
                        Save
                      </Button>
                    )}
                    <Button onClick={cancelDrawing} variant="outline" className="flex-1">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Geofence list */}
          <Card className="bg-gradient-to-br from-card to-muted/30 border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Geofences
                <span className="ml-auto text-sm font-normal text-muted-foreground">{geofences.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading && <div className="text-sm text-muted-foreground text-center py-4">Loading...</div>}
              
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {geofences.length === 0 && !loading && (
                  <div className="text-sm text-muted-foreground text-center py-6">
                    No geofences yet. Create one above.
                  </div>
                )}
                {geofences.map((g) => (
                  <div
                    key={g.id}
                    className={`rounded-xl border-2 p-4 transition-all ${
                      g.active 
                        ? 'border-primary/30 bg-primary/5' 
                        : 'border-border bg-muted/30 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{g.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {g.type === 'circle' ? `Circle (${g.radius_meters}m)` : `Polygon (${JSON.parse(JSON.stringify(g.geometry)).length} points)`}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-2">
                        <button
                          onClick={() => toggleGeofence(g.id, g.active)}
                          className="p-2 hover:bg-accent rounded-lg transition-colors"
                          title={g.active ? 'Deactivate' : 'Activate'}
                        >
                          {g.active ? <Eye className="h-4 w-4 text-primary" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        <button
                          onClick={() => handleDelete(g.id)}
                          className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Map */}
        <Card className="border-2 overflow-hidden">
          <div className="h-[70vh] min-h-[500px]">
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '100%' }}
              center={{ lat: 20, lng: 0 }}
              zoom={2}
              onLoad={(map) => { mapRef.current = map; }}
              onClick={handleMapClick}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: true,
              }}
            >
              {/* Existing Geofences */}
              {geofences.filter(g => g.active).map((g) => {
                if (g.type === 'circle' && g.center_lat && g.center_lng && g.radius_meters) {
                  return (
                    <GoogleCircle
                      key={g.id}
                      center={{ lat: g.center_lat, lng: g.center_lng }}
                      radius={g.radius_meters}
                      options={{
                        fillColor: '#06b6d4',
                        fillOpacity: 0.2,
                        strokeColor: '#06b6d4',
                        strokeWeight: 2,
                      }}
                    />
                  );
                } else if (g.type === 'polygon' && Array.isArray(g.geometry)) {
                  return (
                    <Polygon
                      key={g.id}
                      paths={g.geometry.map((coord: [number, number]) => ({ lat: coord[1], lng: coord[0] }))}
                      options={{
                        fillColor: '#06b6d4',
                        fillOpacity: 0.2,
                        strokeColor: '#06b6d4',
                        strokeWeight: 2,
                      }}
                    />
                  );
                }
                return null;
              })}
              
              {/* Circle Drawing Preview */}
              {drawMode === 'circle' && circleCenter && (
                <GoogleCircle
                  center={{ lat: circleCenter[1], lng: circleCenter[0] }}
                  radius={circleRadius}
                  options={{
                    fillColor: '#f59e0b',
                    fillOpacity: 0.3,
                    strokeColor: '#f59e0b',
                    strokeWeight: 2,
                    strokeOpacity: 0.8,
                  }}
                />
              )}
              
              {/* Polygon Drawing Preview */}
              {drawMode === 'polygon' && polygonPoints.length >= 2 && (
                <Polyline
                  path={polygonPoints.map(pt => ({ lat: pt[1], lng: pt[0] }))}
                  options={{
                    strokeColor: '#f59e0b',
                    strokeWeight: 2,
                    strokeOpacity: 0.8,
                  }}
                />
              )}
            </GoogleMap>
          </div>
        </Card>
      </div>

      {/* Events modal */}
      {showEvents && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border-2">
            <CardHeader className="border-b flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Geofence Alerts
              </CardTitle>
              <button onClick={() => setShowEvents(false)} className="p-2 hover:bg-accent rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent className="p-4 overflow-y-auto flex-1">
              {events.length === 0 ? (
                <div className="text-center text-muted-foreground py-12">
                  <Bell className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>No events yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className={`rounded-xl border-2 p-4 transition-all ${
                        event.acknowledged
                          ? 'border-border bg-muted/30'
                          : 'border-amber-400 bg-amber-50 dark:bg-amber-900/20'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold">
                            {event.device_name} {event.event_type === 'enter' ? 'entered' : 'exited'} {event.geofence_name}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                        </div>
                        {!event.acknowledged && (
                          <Button
                            onClick={() => handleAcknowledge(event.id)}
                            size="sm"
                            variant="outline"
                            className="ml-2"
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Ack
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
