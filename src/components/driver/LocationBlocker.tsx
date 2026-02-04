import { useState, useEffect } from 'react';
import { MapPin, Settings, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

interface LocationBlockerProps {
  onPermissionGranted: () => void;
}

export default function LocationBlocker({ onPermissionGranted }: LocationBlockerProps) {
  const [checking, setChecking] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, label: string) => {
    let timeoutId: number | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
    });

    try {
      return (await Promise.race([promise, timeoutPromise])) as T;
    } finally {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    }
  };

  const checkPermission = async () => {
    setChecking(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor Geolocation for native
        const status = await Geolocation.checkPermissions();
        if (status.location === 'granted' || status.coarseLocation === 'granted') {
          setHasPermission(true);
          onPermissionGranted();
        } else {
          setHasPermission(false);
        }
      } else {
        // Use browser API for web
        const result = await navigator.permissions.query({ name: 'geolocation' });
        if (result.state === 'granted') {
          setHasPermission(true);
          onPermissionGranted();
        } else if (result.state === 'denied') {
          setHasPermission(false);
        } else {
          // Prompt state - try to get location to trigger browser prompt
          try {
            await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
            });
            setHasPermission(true);
            onPermissionGranted();
          } catch {
            setHasPermission(false);
          }
        }
      }
    } catch (error) {
      console.error('Permission check error:', error);
      setHasPermission(false);
    } finally {
      setChecking(false);
    }
  };

  const requestPermission = async () => {
    setRetrying(true);
    try {
      if (Capacitor.isNativePlatform()) {
        // iOS often only shows the permission prompt when calling getCurrentPosition.
        // requestPermissions can remain in 'prompt' state without displaying UI.
        const before = await Geolocation.checkPermissions();
        console.log('[LocationBlocker] native permission before:', before);

        if (before.location !== 'granted' && before.coarseLocation !== 'granted') {
          try {
            await withTimeout(Geolocation.requestPermissions(), 8000, 'REQUEST_PERMISSIONS');
          } catch (e) {
            console.warn('[LocationBlocker] requestPermissions timed out/failed:', e);
          }
        }

        // Trigger the system prompt (or validate permission) with an actual position request.
        try {
          await withTimeout(
            Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0,
            }),
            12000,
            'GET_CURRENT_POSITION'
          );
        } catch (e) {
          console.warn('[LocationBlocker] getCurrentPosition failed:', e);
        }

        const after = await Geolocation.checkPermissions();
        console.log('[LocationBlocker] native permission after:', after);

        if (after.location === 'granted' || after.coarseLocation === 'granted') {
          setHasPermission(true);
          onPermissionGranted();
        } else {
          setHasPermission(false);
        }
      } else {
        // Browser - try to trigger location prompt
        try {
          await withTimeout(
            new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
              });
            }),
            12000,
            'BROWSER_GET_CURRENT_POSITION'
          );
          setHasPermission(true);
          onPermissionGranted();
        } catch {
          setHasPermission(false);
        }
      }
    } catch (error) {
      console.error('Permission request error:', error);
      setHasPermission(false);
    } finally {
      setRetrying(false);
    }
  };

  const openSettings = () => {
    if (Capacitor.isNativePlatform()) {
      // Best-effort deep link to app settings (primarily iOS).
      try {
        window.location.href = 'app-settings:';
      } catch {
        // ignore
      }

      alert(
        'Please open your device Settings > FleetTrackMate > Location and allow location access, then return to the app and tap Retry Check.'
      );
    } else {
      // For browser, provide instructions
      alert('Please click the location icon in your browser address bar and allow location access, then click Retry.');
    }
  };

  useEffect(() => {
    checkPermission();
  }, []);

  // If permission is granted or still checking, don't show blocker
  if (checking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-muted-foreground">Checking location permission...</p>
        </div>
      </div>
    );
  }

  if (hasPermission === true) {
    return null;
  }

  // Show blocker when permission is denied
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center">
          <MapPin className="h-12 w-12 text-destructive" />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-heading font-bold mb-2">Location Required</h1>
          <p className="text-muted-foreground">
            FleetTrackMate needs access to your location to track your position and send it to your fleet manager.
          </p>
        </div>

        {/* Warning */}
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3 text-left">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-warning">Location access is required</p>
            <p className="text-muted-foreground mt-1">
              Without location permission, you cannot access the dashboard, tasks, or SOS features.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <Button 
            onClick={requestPermission} 
            disabled={retrying}
            className="w-full gap-2"
            size="lg"
          >
            {retrying ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                Requesting...
              </>
            ) : (
              <>
                <MapPin className="h-5 w-5" />
                Enable Location
              </>
            )}
          </Button>

          <Button 
            variant="outline" 
            onClick={openSettings}
            className="w-full gap-2"
            size="lg"
          >
            <Settings className="h-5 w-5" />
            Open Settings
          </Button>

          <Button 
            variant="ghost" 
            onClick={checkPermission}
            className="w-full gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Check
          </Button>
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground">
          Your location is only shared with your fleet administrator while you're on duty.
        </p>
      </div>
    </div>
  );
}
