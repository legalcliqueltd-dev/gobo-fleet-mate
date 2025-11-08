import { useState, useRef, useEffect } from 'react';
import { useGeofences } from '../hooks/useGeofences';
import { useGeofenceEvents } from '../hooks/useGeofenceEvents';
import { GoogleMap, Polygon, Polyline, Circle as GoogleCircle, useJsApiLoader } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '../lib/googleMapsConfig';
import { Plus, MapPin, Circle, Trash2, Eye, EyeOff, Bell, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
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
      // Close the polygon by adding first point at the end
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Geofences</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">Create zones and receive alerts when devices enter or exit</p>
        </div>
        <Button onClick={() => setShowEvents(!showEvents)} variant="outline" className="relative">
          <Bell className="h-4 w-4 mr-2" />
          Alerts
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unacknowledgedCount}
            </span>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* Sidebar */}
        <div className="space-y-4">
          {/* Drawing tools */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-4">
            <h3 className="font-semibold mb-3">Create Geofence</h3>
            
            {drawMode === 'none' ? (
              <div className="space-y-2">
                <Button onClick={() => setDrawMode('circle')} className="w-full" variant="outline">
                  <Circle className="h-4 w-4 mr-2" />
                  Draw Circle
                </Button>
                <Button onClick={() => setDrawMode('polygon')} className="w-full" variant="outline">
                  <MapPin className="h-4 w-4 mr-2" />
                  Draw Polygon
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {drawMode === 'circle' && (
                  <>
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      {!circleCenter ? 'Click on map to set center' : 'Adjust radius and save'}
                    </div>
                    {circleCenter && (
                      <div>
                        <label className="text-sm font-medium">Radius (meters)</label>
                        <input
                          type="range"
                          min="100"
                          max="5000"
                          step="100"
                          value={circleRadius}
                          onChange={(e) => setCircleRadius(Number(e.target.value))}
                          className="w-full"
                        />
                        <div className="text-xs text-slate-500 text-center">{circleRadius}m</div>
                      </div>
                    )}
                  </>
                )}
                
                {drawMode === 'polygon' && (
                  <div className="text-sm text-slate-600 dark:text-slate-400">
                    Click on map to add points ({polygonPoints.length} points)
                    {polygonPoints.length >= 3 && ' - Ready to save'}
                  </div>
                )}
                
                <div className="flex gap-2">
                  {((drawMode === 'circle' && circleCenter) || (drawMode === 'polygon' && polygonPoints.length >= 3)) && (
                    <Button
                      onClick={drawMode === 'circle' ? saveCircleGeofence : savePolygonGeofence}
                      className="flex-1"
                    >
                      Save
                    </Button>
                  )}
                  <Button onClick={cancelDrawing} variant="outline" className="flex-1">
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Geofence list */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 backdrop-blur p-4">
            <h3 className="font-semibold mb-3">Geofences ({geofences.length})</h3>
            
            {loading && <div className="text-sm text-slate-500">Loading...</div>}
            
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {geofences.map((g) => (
                <div
                  key={g.id}
                  className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium">{g.name}</div>
                      <div className="text-xs text-slate-500 mt-1">
                        {g.type === 'circle' ? `Circle (${g.radius_meters}m)` : `Polygon (${JSON.parse(JSON.stringify(g.geometry)).length} points)`}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => toggleGeofence(g.id, g.active)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        title={g.active ? 'Deactivate' : 'Activate'}
                      >
                        {g.active ? <Eye className="h-4 w-4 text-emerald-600" /> : <EyeOff className="h-4 w-4 text-slate-400" />}
                      </button>
                      <button
                        onClick={() => handleDelete(g.id)}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="relative h-[70vh] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800">
          {!isLoaded ? (
            <div className="flex items-center justify-center h-full bg-white/60 dark:bg-slate-900/50">
              <p className="text-muted-foreground">Loading map...</p>
            </div>
          ) : (
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
          )}
        </div>
      </div>

      {/* Events modal */}
      {showEvents && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="font-semibold text-lg">Geofence Alerts</h3>
              <button onClick={() => setShowEvents(false)} className="text-slate-500 hover:text-slate-700">
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {events.length === 0 ? (
                <div className="text-center text-slate-500 py-8">No events yet</div>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <div
                      key={event.id}
                      className={`rounded-lg border p-3 ${
                        event.acknowledged
                          ? 'border-slate-200 dark:border-slate-800'
                          : 'border-amber-300 bg-amber-50/50 dark:bg-amber-900/10'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium">
                            {event.device_name} {event.event_type === 'enter' ? 'entered' : 'exited'} {event.geofence_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                        </div>
                        {!event.acknowledged && (
                          <button
                            onClick={() => handleAcknowledge(event.id)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                            title="Acknowledge"
                          >
                            <Check className="h-4 w-4 text-emerald-600" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
