import { useEffect, useState } from 'react';
import { MapPin, AlertCircle, X } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

type PermissionState = 'prompt' | 'granted' | 'denied' | 'unavailable';

export default function LocationPermissionPrompt() {
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const [showDialog, setShowDialog] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    // Check if geolocation is available
    if (!navigator.geolocation) {
      setPermissionState('unavailable');
      setShowDialog(true);
      setChecking(false);
      return;
    }

    // Check permission state
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        
        if (result.state === 'granted') {
          setPermissionState('granted');
          setShowDialog(false);
        } else if (result.state === 'denied') {
          setPermissionState('denied');
          setShowDialog(true);
        } else {
          setPermissionState('prompt');
          // Check localStorage to see if user dismissed the prompt before
          const dismissed = localStorage.getItem('location-prompt-dismissed');
          if (!dismissed) {
            setShowDialog(true);
          }
        }

        // Listen for permission changes
        result.addEventListener('change', () => {
          setPermissionState(result.state as PermissionState);
          if (result.state === 'granted') {
            setShowDialog(false);
          }
        });
      } else {
        // Fallback: try to get position directly
        navigator.geolocation.getCurrentPosition(
          () => {
            setPermissionState('granted');
            setShowDialog(false);
          },
          (error) => {
            if (error.code === error.PERMISSION_DENIED) {
              setPermissionState('denied');
              setShowDialog(true);
            } else {
              setPermissionState('prompt');
              const dismissed = localStorage.getItem('location-prompt-dismissed');
              if (!dismissed) {
                setShowDialog(true);
              }
            }
          }
        );
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
      setPermissionState('prompt');
      const dismissed = localStorage.getItem('location-prompt-dismissed');
      if (!dismissed) {
        setShowDialog(true);
      }
    } finally {
      setChecking(false);
    }
  };

  const requestLocationPermission = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log('Location granted:', position.coords);
        setPermissionState('granted');
        setShowDialog(false);
        localStorage.removeItem('location-prompt-dismissed');
      },
      (error) => {
        console.error('Location error:', error);
        if (error.code === error.PERMISSION_DENIED) {
          setPermissionState('denied');
        }
      }
    );
  };

  const handleDismiss = () => {
    setShowDialog(false);
    localStorage.setItem('location-prompt-dismissed', 'true');
  };

  if (checking || !showDialog) {
    return null;
  }

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-cyan-500/10">
            {permissionState === 'denied' || permissionState === 'unavailable' ? (
              <AlertCircle className="h-8 w-8 text-red-500" />
            ) : (
              <MapPin className="h-8 w-8 text-cyan-500" />
            )}
          </div>
          <DialogTitle className="font-heading text-center">
            {permissionState === 'denied'
              ? 'Location Access Blocked'
              : permissionState === 'unavailable'
              ? 'Location Unavailable'
              : 'Enable Location Access'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {permissionState === 'denied' ? (
              <>
                Location access has been blocked. To use fleet tracking features, please:
                <ol className="mt-3 text-left space-y-2 text-sm">
                  <li>1. Open your browser settings</li>
                  <li>2. Find the permissions or privacy section</li>
                  <li>3. Enable location access for this website</li>
                  <li>4. Refresh the page</li>
                </ol>
              </>
            ) : permissionState === 'unavailable' ? (
              <>
                Your device or browser doesn't support location services. Fleet tracking features require location access to work properly.
              </>
            ) : (
              <>
                FleetTrackMate needs access to your location to:
                <ul className="mt-3 text-left space-y-2 text-sm">
                  <li>• Track vehicle positions in real-time</li>
                  <li>• Monitor driver locations during SOS emergencies</li>
                  <li>• Verify task completion at delivery locations</li>
                  <li>• Provide accurate geofencing alerts</li>
                </ul>
                <p className="mt-3 text-xs text-muted-foreground">
                  Your location data is only used for fleet management and is never shared with third parties.
                </p>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {permissionState === 'prompt' && (
            <Button onClick={requestLocationPermission} className="w-full" size="lg">
              <MapPin className="h-4 w-4 mr-2" />
              Enable Location Access
            </Button>
          )}
          {permissionState === 'denied' && (
            <Button onClick={() => window.location.reload()} className="w-full" size="lg">
              Refresh Page
            </Button>
          )}
          {permissionState === 'prompt' && (
            <Button onClick={handleDismiss} variant="outline" className="w-full">
              Not Now
            </Button>
          )}
          {(permissionState === 'denied' || permissionState === 'unavailable') && (
            <Button onClick={handleDismiss} variant="ghost" className="w-full">
              <X className="h-4 w-4 mr-2" />
              Dismiss
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
