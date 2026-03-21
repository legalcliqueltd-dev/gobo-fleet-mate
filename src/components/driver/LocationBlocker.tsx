import { useState, useEffect, useRef } from 'react';
import { MapPin, Settings, RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { detectNativePlatform, isAndroid } from '@/utils/platformDetection';
import { isGeolocationPluginAvailable, getGeolocationUnavailableReason } from '@/utils/nativeGeolocation';

interface LocationBlockerProps {
  onPermissionGranted: () => void;
}

export default function LocationBlocker({ onPermissionGranted }: LocationBlockerProps) {
  const [checking, setChecking] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [permissionDebug, setPermissionDebug] = useState<string>('');
  const [pluginMissing, setPluginMissing] = useState(false);
  const checkPermissionRef = useRef<(() => void) | null>(null);

  const isNative = detectNativePlatform();
  const isAndroidNative = isAndroid();

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
    const platform = Capacitor.getPlatform();
    console.log(`[LocationBlocker] checkPermission — isNative=${isNative}, platform=${platform}, isAndroid=${isAndroidNative}`);

    // Check if native plugin is available first
    const unavailableReason = getGeolocationUnavailableReason();
    if (isNative && unavailableReason) {
      console.error(`[LocationBlocker] Plugin unavailable: ${unavailableReason}`);
      setPluginMissing(true);
      setPermissionDebug(`plugin_missing: ${unavailableReason}`);
      setHasPermission(false);
      setChecking(false);
      return;
    }

    try {
      if (isNative && isGeolocationPluginAvailable()) {
        const status = await Geolocation.checkPermissions();
        const debugStr = `native(${platform}): location=${status.location ?? 'n/a'} coarse=${status.coarseLocation ?? 'n/a'}`;
        console.log(`[LocationBlocker] ${debugStr}`);
        setPermissionDebug(debugStr);

        if (status.location === 'granted' || status.coarseLocation === 'granted') {
          setHasPermission(true);
          onPermissionGranted();
        } else {
          const isPrompt = status.location === 'prompt' || status.coarseLocation === 'prompt';
          if (isPrompt) {
            try {
              console.log('[LocationBlocker] Permission is prompt — attempting getCurrentPosition to trigger system dialog');
              await withTimeout(
                Geolocation.getCurrentPosition({
                  enableHighAccuracy: true,
                  timeout: isAndroidNative ? 15000 : 10000,
                  maximumAge: 0,
                }),
                isAndroidNative ? 18000 : 12000,
                'CHECK_GET_CURRENT_POSITION'
              );

              setHasPermission(true);
              onPermissionGranted();
            } catch (e) {
              console.warn('[LocationBlocker] prompt getCurrentPosition failed:', e);
              setHasPermission(false);
            }
          } else {
            setHasPermission(false);
          }
        }
      } else {
        // Use browser API for web
        console.log('[LocationBlocker] Using browser geolocation API (non-native)');
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionDebug(`web: ${result.state}`);
        if (result.state === 'granted') {
          setHasPermission(true);
          onPermissionGranted();
        } else if (result.state === 'denied') {
          setHasPermission(false);
        } else {
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
      console.error('[LocationBlocker] Permission check error:', error);
      setHasPermission(false);
    } finally {
      setChecking(false);
    }
  };

  const requestPermission = async () => {
    setRetrying(true);
    console.log(`[LocationBlocker] requestPermission — isNative=${isNative}, isAndroid=${isAndroidNative}`);

    if (pluginMissing) {
      console.error('[LocationBlocker] Cannot request permission — native plugin is missing');
      setRetrying(false);
      return;
    }

    try {
      if (isNative && isGeolocationPluginAvailable()) {
        const before = await Geolocation.checkPermissions();
        console.log('[LocationBlocker] native permission before:', JSON.stringify(before));

        if (before.location !== 'granted' && before.coarseLocation !== 'granted') {
          try {
            console.log('[LocationBlocker] Calling Geolocation.requestPermissions()...');
            const reqResult = await withTimeout(
              Geolocation.requestPermissions({ permissions: ['location'] }),
              isAndroidNative ? 15000 : 8000,
              'REQUEST_PERMISSIONS'
            );
            console.log('[LocationBlocker] requestPermissions result:', JSON.stringify(reqResult));
          } catch (e) {
            console.warn('[LocationBlocker] requestPermissions timed out/failed:', e);
          }
        }

        // On Android, also force a getCurrentPosition to trigger the system dialog
        try {
          console.log('[LocationBlocker] Calling getCurrentPosition to force system dialog...');
          await withTimeout(
            Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: isAndroidNative ? 15000 : 10000,
              maximumAge: 0,
            }),
            isAndroidNative ? 18000 : 12000,
            'GET_CURRENT_POSITION'
          );
          console.log('[LocationBlocker] getCurrentPosition succeeded — permission granted');
        } catch (e) {
          console.warn('[LocationBlocker] getCurrentPosition failed:', e);
        }

        const after = await Geolocation.checkPermissions();
        console.log('[LocationBlocker] native permission after:', JSON.stringify(after));

        if (after.location === 'granted' || after.coarseLocation === 'granted') {
          setHasPermission(true);
          onPermissionGranted();
        } else {
          setHasPermission(false);
          setPermissionDebug(`native(${Capacitor.getPlatform()}): location=${after.location} coarse=${after.coarseLocation}`);
        }
      } else {
        // Browser fallback
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
      console.error('[LocationBlocker] Permission request error:', error);
      setHasPermission(false);
    } finally {
      setRetrying(false);
    }
  };

  const openSettings = () => {
    if (isNative) {
      if (isAndroidNative) {
        try {
          window.location.href = 'intent:#Intent;action=android.settings.APPLICATION_DETAILS_SETTINGS;data=package:app.fleettrackmate.driver;end';
        } catch {
          alert(
            'Please open your device Settings > Apps > FleetTrackMate Driver > Permissions > Location and allow location access, then return to the app and tap Retry Check.'
          );
        }
      } else {
        try {
          window.location.href = 'app-settings:';
        } catch {
          // ignore
        }
        alert(
          'Please open your device Settings > FleetTrackMate > Location and allow location access, then return to the app and tap Retry Check.'
        );
      }
    } else {
      alert('Please click the location icon in your browser address bar and allow location access, then click Retry.');
    }
  };

  useEffect(() => {
    checkPermission();
  }, []);

  checkPermissionRef.current = () => {
    void checkPermission();
  };

  useEffect(() => {
    const onFocus = () => {
      if (hasPermission === true) return;
      checkPermissionRef.current?.();
    };

    const onVisibilityChange = () => {
      if (hasPermission === true) return;
      if (document.visibilityState === 'visible') {
        checkPermissionRef.current?.();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [hasPermission]);

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

  // Plugin missing — show a specific error UI
  if (pluginMissing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center">
            <WifiOff className="h-12 w-12 text-destructive" />
          </div>

          <div>
            <h1 className="text-2xl font-heading font-bold mb-2">Native Plugin Missing</h1>
            <p className="text-muted-foreground">
              The location plugin could not be loaded. This usually happens when the app loads from a remote URL instead of bundled assets.
            </p>
          </div>

          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 text-left text-sm space-y-2">
            <p className="font-medium text-destructive">How to fix:</p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-1">
              <li>Run <code className="bg-muted px-1 rounded">npm run build</code></li>
              <li>Run <code className="bg-muted px-1 rounded">npx cap sync android</code></li>
              <li>Run the post-sync cleanup script</li>
              <li>Reinstall the app from Android Studio</li>
            </ol>
          </div>

          <Button
            variant="ghost"
            onClick={() => window.location.reload()}
            className="w-full gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Reload App
          </Button>

          {permissionDebug && (
            <p className="text-[11px] text-muted-foreground break-words">
              Debug: {permissionDebug}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center">
          <MapPin className="h-12 w-12 text-destructive" />
        </div>

        <div>
          <h1 className="text-2xl font-heading font-bold mb-2">Location Required</h1>
          <p className="text-muted-foreground">
            FleetTrackMate needs access to your location to track your position and send it to your fleet manager.
          </p>
        </div>

        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4 flex items-start gap-3 text-left">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-warning">Location access is required</p>
            <p className="text-muted-foreground mt-1">
              Without location permission, you cannot access the dashboard, tasks, or SOS features.
            </p>
            {isNative && permissionDebug.includes('prompt') && (
              <p className="text-muted-foreground mt-2">
                {isAndroidNative ? (
                  <>Tap <span className="font-medium">Enable Location</span> and select <span className="font-medium">Allow</span> or <span className="font-medium">While using the app</span> when the system dialog appears.</>
                ) : (
                  <>iOS is currently set to <span className="font-medium">Ask Next Time / When I Share</span>. Tap{' '}
                  <span className="font-medium">Enable Location</span> to trigger the prompt, and choose{' '}
                  <span className="font-medium">While Using the App</span> for reliable tracking.</>
                )}
              </p>
            )}
          </div>
        </div>

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

        <p className="text-xs text-muted-foreground">
          Your location is only shared with your fleet administrator while you're on duty.
        </p>

        {permissionDebug && (
          <p className="text-[11px] text-muted-foreground break-words">
            Permission: {permissionDebug}
          </p>
        )}
      </div>
    </div>
  );
}
