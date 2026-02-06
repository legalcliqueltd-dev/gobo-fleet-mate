import { useState, useEffect, useCallback } from 'react';
import { GoogleMap, useJsApiLoader, DirectionsRenderer, Marker } from '@react-google-maps/api';
import { GOOGLE_MAPS_API_KEY } from '@/lib/googleMapsConfig';
import { Button } from '@/components/ui/button';
import { X, Navigation, LocateFixed } from 'lucide-react';

type TaskNavigationMapProps = {
  dropoffLat: number;
  dropoffLng: number;
  taskTitle: string;
  onClose: () => void;
};

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

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
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Watch current position
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentPosition({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setError(null);
      },
      (err) => {
        console.error('Location error:', err);
        setError('Unable to get your location');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Calculate route when position is available
  useEffect(() => {
    if (!currentPosition || !isLoaded) return;

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
          }
        } else {
          console.error('Directions error:', status);
          setError('Could not calculate route');
        }
      }
    );
  }, [currentPosition, dropoffLat, dropoffLng, isLoaded]);

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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const center = currentPosition || { lat: dropoffLat, lng: dropoffLng };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{taskTitle}</h2>
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
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={14}
          onLoad={onLoad}
          options={{
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          }}
        >
          {/* Route */}
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#3b82f6',
                  strokeWeight: 5,
                },
              }}
            />
          )}

          {/* Current position marker */}
          {currentPosition && (
            <Marker
              position={currentPosition}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#22c55e',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              }}
            />
          )}

          {/* Destination marker */}
          <Marker
            position={{ lat: dropoffLat, lng: dropoffLng }}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              scale: 12,
              fillColor: '#ef4444',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            }}
          />
        </GoogleMap>

        {/* Error overlay */}
        {error && (
          <div className="absolute top-4 left-4 right-4 bg-destructive/90 text-destructive-foreground p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Map controls */}
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
