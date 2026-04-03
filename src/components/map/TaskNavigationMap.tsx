import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer } from '@react-google-maps/api';
import AdvancedMarker from '@/components/map/AdvancedMarker';
import DriverLocationMarker from '@/components/map/DriverLocationMarker';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { Button } from '@/components/ui/button';
import { X, Navigation, LocateFixed } from 'lucide-react';
import { cn } from '@/lib/utils';

type TaskNavigationMapProps = {
  dropoffLat: number;
  dropoffLng: number;
  taskTitle: string;
  onClose: () => void;
};

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Clean map style for navigation
const NAV_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

export default function TaskNavigationMap({
  dropoffLat,
  dropoffLng,
  taskTitle,
  onClose,
}: TaskNavigationMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  });

  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [nextStep, setNextStep] = useState<{ instruction: string; distance: string } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isArrived, setIsArrived] = useState(false);
  const lastRouteCalc = useRef(0);

  // Watch current position
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setCurrentPosition(pos);
        if (position.coords.heading !== null) setHeading(position.coords.heading);
        setError(null);

        // Check arrival (within 50m)
        const dist = calculateDistance(pos.lat, pos.lng, dropoffLat, dropoffLng);
        setIsArrived(dist < 0.05);
      },
      (err) => {
        console.error('Location error:', err);
        setError('Unable to get your location');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [dropoffLat, dropoffLng]);

  // Auto-recenter on driver
  useEffect(() => {
    if (map && currentPosition) {
      map.panTo(currentPosition);
    }
  }, [currentPosition, map]);

  // Calculate/recalculate route (throttled to every 30s)
  useEffect(() => {
    if (!currentPosition || !isLoaded) return;
    const now = Date.now();
    if (now - lastRouteCalc.current < 30000 && directions) return;
    lastRouteCalc.current = now;

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: currentPosition,
        destination: { lat: dropoffLat, lng: dropoffLng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          setDirections(result);
          const leg = result.routes[0]?.legs[0];
          if (leg) {
            setRouteInfo({
              distance: leg.distance?.text || '',
              duration: leg.duration?.text || '',
            });
            // Next step
            const step = leg.steps[0];
            if (step) {
              setNextStep({
                instruction: step.instructions.replace(/<[^>]*>/g, ''),
                distance: step.distance?.text || '',
              });
            }
          }
        } else {
          console.error('Directions error:', status);
          setError('Could not calculate route');
        }
      }
    );
  }, [currentPosition, dropoffLat, dropoffLng, isLoaded, directions]);

  const onLoad = useCallback((mapInstance: google.maps.Map) => {
    setMap(mapInstance);
  }, []);

  const centerOnMe = () => {
    if (map && currentPosition) {
      map.panTo(currentPosition);
      map.setZoom(16);
    }
  };

  const openInGoogleMaps = () => {
    if (currentPosition) {
      const url = `https://www.google.com/maps/dir/?api=1&origin=${currentPosition.lat},${currentPosition.lng}&destination=${dropoffLat},${dropoffLng}&travelmode=driving`;
      window.open(url, '_blank');
    } else {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${dropoffLat},${dropoffLng}&travelmode=driving`;
      window.open(url, '_blank');
    }
  };

  if (!isLoaded) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const center = currentPosition || { lat: dropoffLat, lng: dropoffLng };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Turn-by-turn info strip */}
      {nextStep && !isArrived && (
        <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
          <Navigation className="h-5 w-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{nextStep.instruction}</p>
            <p className="text-xs opacity-80">{nextStep.distance}</p>
          </div>
        </div>
      )}

      {/* Arrival banner */}
      {isArrived && (
        <div className="bg-success text-success-foreground px-4 py-3 text-center font-semibold">
          📍 You've arrived at the drop-off!
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex-1 min-w-0">
          <h2 className="font-bold truncate">{taskTitle}</h2>
          {routeInfo && (
            <p className="text-sm text-muted-foreground">
              {routeInfo.duration} • {routeInfo.distance}
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={center}
          zoom={16}
          onLoad={onLoad}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            styles: NAV_MAP_STYLE,
          }}
        >
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#3b82f6',
                  strokeWeight: 6,
                  strokeOpacity: 0.9,
                },
              }}
            />
          )}

          {currentPosition && (
            <DriverLocationMarker
              position={currentPosition}
              isTracking={true}
              heading={heading}
            />
          )}

          {/* Destination marker */}
          <AdvancedMarker
            position={{ lat: dropoffLat, lng: dropoffLng }}
            iconSize={36}
          >
            <div className="w-9 h-9 rounded-full bg-destructive border-[3px] border-white shadow-xl flex items-center justify-center">
              <span className="text-xs font-bold">📍</span>
            </div>
          </AdvancedMarker>
        </GoogleMap>

        {error && (
          <div className="absolute top-4 left-4 right-4 bg-destructive/90 text-destructive-foreground p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={centerOnMe}
          >
            <LocateFixed className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t bg-background">
        <Button className="w-full" size="lg" onClick={openInGoogleMaps}>
          <Navigation className="h-5 w-5 mr-2" />
          Open in Google Maps
        </Button>
      </div>
    </div>
  );
}
