import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Settings, RefreshCw, AlertTriangle, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { detectNativePlatform, isAndroid } from '@/utils/platformDetection';
import { isGeolocationPluginAvailable, isAnyGeolocationAvailable } from '@/utils/nativeGeolocation';

interface LocationBlockerProps {
  onPermissionGranted: () => void;
}

export default function LocationBlocker({ onPermissionGranted }: LocationBlockerProps) {
  const [checking, setChecking] = useState(true);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [permissionDebug, setPermissionDebug] = useState<string>('');
  const [pluginMissing, setPluginMissing] = useState(false);
  const [permanentlyDenied, setPermanentlyDenied] = useState(false);
  const [waitingForSettingsReturn, setWaitingForSettingsReturn] = useState(false);

  // Prevents automatic re-checks after initial denied result
  const hasAttemptedRequest = useRef(false);
  const isCheckingRef = useRef(false);
  const resumeFromSettingsRef = useRef(false);

  const isNative = detectNativePlatform();
  const isAndroidNative = isAndroid();
  const useNativePlugin = isNative && isGeolocationPluginAvailable();

  const checkPermission = useCallback(async (isManual = false) => {
    // Prevent concurrent checks
    if (isCheckingRef.current) {
      console.log('[LocationBlocker] checkPermission skipped — already in progress');
      return;
    }

    // On Android, if we already got denied and this is an automatic (non-manual) re-check, skip it
    if (!isManual && hasAttemptedRequest.current && isAndroidNative) {
      console.log('[LocationBlocker] checkPermission skipped — already attempted on Android, use manual retry');
      return;
    }

    isCheckingRef.current = true;
    setChecking(true);
    const platform = Capacitor.getPlatform();
    console.log(`[LocationBlocker] checkPermission — isNative=${isNative}, platform=${platform}, useNativePlugin=${useNativePlugin}, isManual=${isManual}`);

    if (!isAnyGeolocationAvailable()) {
      console.error('[LocationBlocker] No geolocation available at all');
      setPluginMissing(true);
      setPermissionDebug('no_geolocation_available');
      setHasPermission(false);
      setChecking(false);
      isCheckingRef.current = false;
      return;
    }

    try {
      if (useNativePlugin) {
        try {
          const status = await Geolocation.checkPermissions();
          const debugStr = `native(${platform}): location=${status.location ?? 'n/a'} coarse=${status.coarseLocation ?? 'n/a'}`;
          console.log(`[LocationBlocker] ${debugStr}`);
          setPermissionDebug(debugStr);

          if (status.location === 'granted' || status.coarseLocation === 'granted') {
            console.log('[LocationBlocker] Permission already granted');
            setHasPermission(true);
            setPermanentlyDenied(false);
            setWaitingForSettingsReturn(false);
            resumeFromSettingsRef.current = false;
            onPermissionGranted();
          } else if (status.location === 'prompt' || status.coarseLocation === 'prompt') {
            // Permission not yet asked — try getCurrentPosition to trigger system dialog
            console.log('[LocationBlocker] Permission is prompt — calling getCurrentPosition to trigger dialog');
            try {
              await Geolocation.getCurrentPosition({
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0,
              });
              console.log('[LocationBlocker] getCurrentPosition succeeded — granted');
              setHasPermission(true);
              setPermanentlyDenied(false);
              setWaitingForSettingsReturn(false);
              resumeFromSettingsRef.current = false;
              onPermissionGranted();
            } catch (e) {
              console.warn('[LocationBlocker] prompt getCurrentPosition failed:', e);
              setHasPermission(false);
            }
          } else {
            // status is "denied" — on Android this could mean "never asked" OR "permanently denied"
            // Do NOT auto-retry. Show the blocked UI.
            console.log('[LocationBlocker] Permission denied — showing blocked UI');
            setHasPermission(false);
            if (isAndroidNative) {
              hasAttemptedRequest.current = true;
            }
          }
        } catch (nativeErr) {
          console.warn('[LocationBlocker] Native plugin failed:', nativeErr);
          if (!isAndroidNative) {
            await tryBrowserGeolocation();
          } else {
            console.error('[LocationBlocker] Android native — skipping browser fallback');
            setHasPermission(false);
          }
        }
      } else {
        await tryBrowserGeolocation();
      }
    } catch (error) {
      console.error('[LocationBlocker] Permission check error:', error);
      setHasPermission(false);
    } finally {
      setChecking(false);
      isCheckingRef.current = false;
    }
  }, [isNative, isAndroidNative, useNativePlugin, onPermissionGranted]);

  // Browser geolocation fallback (non-Android only)
  const tryBrowserGeolocation = async () => {
    console.log('[LocationBlocker] Using browser geolocation API fallback');
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionDebug(`browser_fallback: ${result.state}`);
        if (result.state === 'granted') {
          setHasPermission(true);
          onPermissionGranted();
        } else if (result.state === 'denied') {
          setHasPermission(false);
        } else {
          try {
            await new Promise<GeolocationPosition>((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });
            setHasPermission(true);
            onPermissionGranted();
          } catch {
            setHasPermission(false);
          }
        }
      } else {
        try {
          await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
          });
          setHasPermission(true);
          onPermissionGranted();
        } catch {
          setHasPermission(false);
        }
      }
    } catch {
      setHasPermission(false);
    }
  };

  const requestPermission = async () => {
    setRetrying(true);
    console.log(`[LocationBlocker] requestPermission — isNative=${isNative}, useNativePlugin=${useNativePlugin}`);

    try {
      if (useNativePlugin) {
        try {
          // Step 1: Call requestPermissions() exactly once — no timeout on first attempt
          // to let the OS dialog appear naturally
          console.log('[LocationBlocker] Calling Geolocation.requestPermissions() (no args, no timeout)...');
          const reqResult = await Geolocation.requestPermissions();
          console.log('[LocationBlocker] requestPermissions result:', JSON.stringify(reqResult));

          if (reqResult.location === 'granted' || reqResult.coarseLocation === 'granted') {
            console.log('[LocationBlocker] Permission granted via requestPermissions');
            setHasPermission(true);
            setPermanentlyDenied(false);
            setWaitingForSettingsReturn(false);
            resumeFromSettingsRef.current = false;
            onPermissionGranted();
            return;
          }

          // Step 2: Try getCurrentPosition as a secondary trigger
          try {
            console.log('[LocationBlocker] Trying getCurrentPosition after requestPermissions...');
            await Geolocation.getCurrentPosition({
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 0,
            });
            console.log('[LocationBlocker] getCurrentPosition succeeded — granted');
            setHasPermission(true);
            setPermanentlyDenied(false);
            setWaitingForSettingsReturn(false);
            resumeFromSettingsRef.current = false;
            onPermissionGranted();
            return;
          } catch (posErr) {
            console.warn('[LocationBlocker] getCurrentPosition failed:', posErr);
          }

          // Step 3: Re-check status
          const after = await Geolocation.checkPermissions();
          console.log('[LocationBlocker] Permission after attempt:', JSON.stringify(after));
          setPermissionDebug(`native(${Capacitor.getPlatform()}): location=${after.location} coarse=${after.coarseLocation}`);

          if (after.location === 'granted' || after.coarseLocation === 'granted') {
            setHasPermission(true);
            setPermanentlyDenied(false);
            setWaitingForSettingsReturn(false);
            resumeFromSettingsRef.current = false;
            onPermissionGranted();
          } else {
            setHasPermission(false);
            hasAttemptedRequest.current = true;
            if (isAndroidNative) {
              // On Android, if still denied after explicit request, it's likely permanently denied
              setPermanentlyDenied(true);
              console.log('[LocationBlocker] Android: still denied after request — likely permanently denied, directing to Settings');
            }
          }
        } catch (nativeErr) {
          console.warn('[LocationBlocker] Native plugin failed in requestPermission:', nativeErr);
          if (!isAndroidNative) {
            await requestBrowserPermission();
          } else {
            console.error('[LocationBlocker] Android native — skipping browser fallback');
            setHasPermission(false);
            hasAttemptedRequest.current = true;
          }
        }
      } else {
        await requestBrowserPermission();
      }
    } catch (error) {
      console.error('[LocationBlocker] Permission request error:', error);
      setHasPermission(false);
    } finally {
      setRetrying(false);
    }
  };

  const requestBrowserPermission = async () => {
    console.log('[LocationBlocker] Requesting via browser geolocation API...');
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      setHasPermission(true);
      onPermissionGranted();
    } catch {
      setHasPermission(false);
    }
  };

  const openSettings = () => {
    if (isNative) {
      resumeFromSettingsRef.current = true;
      setWaitingForSettingsReturn(true);

      if (isAndroidNative) {
        // Show instructions first, then try intent
        alert(
          'To enable location:\n\n1. Tap OK to open App Settings\n2. Tap "Permissions"\n3. Tap "Location"\n4. Select "Allow all the time" or "Allow only while using the app"\n5. Return to FleetTrackMate and tap "Retry Check"'
        );

        try {
          window.location.href = 'intent://app.fleettrackmate.driver#Intent;scheme=package;action=android.settings.APPLICATION_DETAILS_SETTINGS;end';
        } catch {
          console.warn('[LocationBlocker] Android settings intent failed');
        }

        window.setTimeout(() => {
          if (document.visibilityState === 'visible') {
            console.warn('[LocationBlocker] Settings screen did not open automatically');
            setPermissionDebug('android_settings_open_failed_or_blocked');
          }
        }, 1200);
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

  // Initial check on mount
  useEffect(() => {
    checkPermission(false);
  }, []);

  // Focus/visibility listeners — only re-check if we haven't been permanently denied
  useEffect(() => {
    const runResumeCheck = () => {
      if (!resumeFromSettingsRef.current || hasPermission === true) return false;

      console.log('[LocationBlocker] App resumed after Settings — rechecking permission');
      resumeFromSettingsRef.current = false;
      setWaitingForSettingsReturn(false);
      checkPermission(true);
      return true;
    };

    const onFocus = () => {
      if (hasPermission === true) return;
      if (runResumeCheck()) return;
      // Only auto-recheck if we haven't exhausted attempts on Android
      checkPermission(false);
    };

    const onVisibilityChange = () => {
      if (hasPermission === true) return;
      if (document.visibilityState === 'visible') {
        if (runResumeCheck()) return;
        checkPermission(false);
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [hasPermission, checkPermission]);

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

  if (pluginMissing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center">
            <WifiOff className="h-12 w-12 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-heading font-bold mb-2">Location Unavailable</h1>
            <p className="text-muted-foreground">
              Neither the native location plugin nor the browser geolocation API could be loaded.
            </p>
          </div>
          <Button variant="ghost" onClick={() => window.location.reload()} className="w-full gap-2">
            <RefreshCw className="h-4 w-4" />
            Reload App
          </Button>
          {permissionDebug && (
            <p className="text-[11px] text-muted-foreground break-words">Debug: {permissionDebug}</p>
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
            {permanentlyDenied ? (
              <>
                <p className="font-medium text-warning">Location permanently blocked</p>
                <p className="text-muted-foreground mt-1">
                  You previously denied location access. To use the app, you must enable it manually in your device Settings.
                </p>
                <p className="text-muted-foreground mt-2">
                  Tap <span className="font-medium">Open Settings</span> below, then go to <span className="font-medium">Permissions → Location</span> and select <span className="font-medium">Allow</span>.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-warning">Location access is required</p>
                <p className="text-muted-foreground mt-1">
                  Without location permission, you cannot access the dashboard, tasks, or SOS features.
                </p>
                {isNative && (
                  <p className="text-muted-foreground mt-2">
                    {isAndroidNative ? (
                      <>Tap <span className="font-medium">Enable Location</span> and select <span className="font-medium">Allow</span> or <span className="font-medium">While using the app</span> when the system dialog appears.</>
                    ) : (
                      <>Tap <span className="font-medium">Enable Location</span> to trigger the prompt, and choose{' '}
                      <span className="font-medium">While Using the App</span> for reliable tracking.</>
                    )}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {waitingForSettingsReturn && (
            <div className="rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground text-left">
              Waiting for you to return from Settings. When you come back, the app will check location permission automatically.
            </div>
          )}

          {!permanentlyDenied && (
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
          )}

          <Button
            variant={permanentlyDenied ? 'default' : 'outline'}
            onClick={openSettings}
            className="w-full gap-2"
            size="lg"
          >
            <Settings className="h-5 w-5" />
            Open Settings
          </Button>

          <Button
            variant="ghost"
            onClick={() => {
              hasAttemptedRequest.current = false;
              setPermanentlyDenied(false);
              checkPermission(true);
            }}
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
