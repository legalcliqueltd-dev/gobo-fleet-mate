import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Settings, RefreshCw, AlertTriangle, WifiOff, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { detectNativePlatform, isAndroid } from '@/utils/platformDetection';
import { isGeolocationPluginAvailable, isAnyGeolocationAvailable } from '@/utils/nativeGeolocation';
import { useNavigate } from 'react-router-dom';

interface LocationBlockerProps {
  onPermissionGranted: () => void;
}

// Explicit permission states — no hidden branching
type PermState =
  | 'idle'
  | 'checking'
  | 'requesting'
  | 'granted'
  | 'denied'        // user denied but can retry
  | 'blocked'       // permanently denied — needs Settings
  | 'plugin_missing'
  | 'error';

export default function LocationBlocker({ onPermissionGranted }: LocationBlockerProps) {
  const [state, setState] = useState<PermState>('idle');
  const [debug, setDebug] = useState('');
  const hasAutoRequested = useRef(false);
  const navigate = useNavigate();

  const isNative = detectNativePlatform();
  const isAndroidNative = isAndroid();
  const useNativePlugin = isNative && isGeolocationPluginAvailable();

  const appendDebug = (msg: string) => {
    console.log(`[LocationBlocker] ${msg}`);
    setDebug(prev => `${prev}\n${msg}`);
  };

  // ── Core permission check ──
  const check = useCallback(async () => {
    setState('checking');

    if (!isAnyGeolocationAvailable()) {
      appendDebug('No geolocation available');
      setState('plugin_missing');
      return;
    }

    try {
      if (useNativePlugin) {
        const status = await Geolocation.checkPermissions();
        appendDebug(`check: location=${status.location} coarse=${status.coarseLocation}`);

        if (status.location === 'granted' || status.coarseLocation === 'granted') {
          setState('granted');
          onPermissionGranted();
          return;
        }

        if (status.location === 'prompt' || status.coarseLocation === 'prompt') {
          // Never asked yet: show the prominent disclosure screen FIRST.
          // Google Play policy requires the in-app disclosure BEFORE the
          // system permission dialog — never auto-fire the prompt.
          appendDebug('Permission not yet requested — showing disclosure');
          setState('denied');
          return;
        }

        // "denied" — on Android first launch this can also mean "never asked".
        // Same rule: show the disclosure screen; the user taps Enable to trigger
        // the system dialog.
        if (isAndroidNative && !hasAutoRequested.current) {
          appendDebug('Android reports denied (possibly never asked) — showing disclosure');
          setState('denied');
          return;
        }

        // Already tried — show appropriate UI
        setState(isAndroidNative ? 'blocked' : 'denied');
      } else {
        // Browser path
        await checkBrowser();
      }
    } catch (e: any) {
      appendDebug(`check error: ${e?.message || e}`);
      setState('error');
    }
  }, [useNativePlugin, isAndroidNative, onPermissionGranted]);

  // ── Native permission request (only ever triggered by the user's tap on the
  //     disclosure screen — Play policy: disclosure BEFORE the system prompt) ──
  const requestNative = async () => {
    hasAutoRequested.current = true;
    setState('requesting');
    let granted = false;

    // Attempt 1: getCurrentPosition — most reliable OS dialog trigger on Android
    try {
      appendDebug('Attempting getCurrentPosition...');
      await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      appendDebug('getCurrentPosition succeeded');
      granted = true;
    } catch (e: any) {
      appendDebug(`getCurrentPosition failed: ${e?.message || e}`);
    }

    // Attempt 2: requestPermissions — fallback
    if (!granted) {
      try {
        appendDebug('Attempting requestPermissions...');
        const result = await Geolocation.requestPermissions();
        appendDebug(`requestPermissions: ${JSON.stringify(result)}`);
        if (result.location === 'granted' || result.coarseLocation === 'granted') {
          granted = true;
        }
      } catch (e: any) {
        appendDebug(`requestPermissions failed: ${e?.message || e}`);
      }
    }

    // Attempt 3: re-check status
    if (!granted) {
      try {
        const recheck = await Geolocation.checkPermissions();
        appendDebug(`recheck: ${JSON.stringify(recheck)}`);
        if (recheck.location === 'granted' || recheck.coarseLocation === 'granted') {
          granted = true;
        }
      } catch { /* ignore */ }
    }

    if (granted) {
      setState('granted');
      onPermissionGranted();
    } else {
      // If we already auto-requested once, mark as blocked for Settings redirect
      setState(hasAutoRequested.current ? 'blocked' : 'denied');
    }
  };

  // ── Browser permission check ──
  const checkBrowser = async () => {
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
      });
      setState('granted');
      onPermissionGranted();
    } catch {
      setState('denied');
    }
  };

  // ── Manual retry (button tap) ──
  const handleRetry = async () => {
    if (useNativePlugin) {
      await requestNative();
    } else {
      await checkBrowser();
    }
  };

  // ── Open device settings ──
  const openSettings = () => {
    if (isAndroidNative) {
      alert(
        'To enable location:\n\n1. Tap OK to open App Settings\n2. Tap "Permissions"\n3. Tap "Location"\n4. Select "Allow all the time" or "Allow only while using the app"\n5. Return to FleetTrackMate'
      );
      try {
        window.location.href = 'intent://app.fleettrackmate.driver#Intent;scheme=package;action=android.settings.APPLICATION_DETAILS_SETTINGS;end';
      } catch { /* ignore */ }
    } else if (isNative) {
      try { window.location.href = 'app-settings:'; } catch { /* ignore */ }
      alert('Open Settings > FleetTrackMate > Location and allow access, then return here.');
    } else {
      alert('Click the location icon in your browser address bar and allow location access.');
    }
  };

  // ── Focus/visibility listener for return from Settings ──
  useEffect(() => {
    const onResume = () => {
      if (state === 'blocked' || state === 'denied') {
        appendDebug('App resumed — rechecking');
        check();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onResume();
    };
    window.addEventListener('focus', onResume);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onResume);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [state, check]);

  // ── Initial check ──
  useEffect(() => {
    check();
  }, []);

  // ── Granted — render nothing ──
  if (state === 'granted') return null;

  // ── Checking / Requesting — spinner ──
  if (state === 'idle' || state === 'checking' || state === 'requesting') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4 p-6">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-muted-foreground text-sm">
          {state === 'requesting' ? 'Requesting location permission...' : 'Checking location permission...'}
        </p>
        {debug && <pre className="text-xs text-muted-foreground max-w-sm overflow-auto mt-4 p-2 bg-muted rounded">{debug}</pre>}
      </div>
    );
  }

  // ── Plugin missing ──
  if (state === 'plugin_missing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4 p-6 text-center">
        <WifiOff className="h-16 w-16 text-destructive" />
        <h2 className="text-xl font-bold text-foreground">Location Unavailable</h2>
        <p className="text-muted-foreground">The location plugin could not be loaded. Please reinstall the app.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/app/diagnostics')}>
          <Bug className="h-4 w-4 mr-2" />Run Diagnostics
        </Button>
        {debug && <pre className="text-xs text-muted-foreground max-w-sm overflow-auto mt-4 p-2 bg-muted rounded">{debug}</pre>}
      </div>
    );
  }

  // ── Blocked (permanently denied) ──
  if (state === 'blocked') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-4 p-6 text-center">
        <AlertTriangle className="h-16 w-16 text-warning" />
        <h2 className="text-xl font-bold text-foreground">Location Permission Required</h2>
        <p className="text-muted-foreground">Location access was denied. Please enable it in your device settings.</p>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <Button onClick={openSettings}>
            <Settings className="h-4 w-4 mr-2" />Open Settings
          </Button>
          <Button variant="outline" onClick={() => check()}>
            <RefreshCw className="h-4 w-4 mr-2" />Retry Check
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app/diagnostics')}>
            <Bug className="h-4 w-4 mr-2" />Run Diagnostics
          </Button>
        </div>
        {debug && <pre className="text-xs text-muted-foreground max-w-sm overflow-auto mt-4 p-2 bg-muted rounded">{debug}</pre>}
      </div>
    );
  }

  // ── Prominent disclosure (Google Play requirement) + retry ──
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-5 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent">
        <MapPin className="h-10 w-10 text-primary" />
      </div>
      <h2 className="font-heading text-2xl font-bold text-foreground">Location sharing</h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        FleetTrackMate Driver collects location data to share your live position with your
        fleet manager while you are on duty, <strong className="text-foreground">even when the
        app is closed or not in use</strong>. Sharing starts only when you go On Duty, shows a
        permanent notification while active, and stops when you go Off Duty.
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button size="lg" onClick={handleRetry}>
          <MapPin className="mr-2 h-4 w-4" />Allow location access
        </Button>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/diagnostics')}>
          <Bug className="mr-2 h-4 w-4" />Run Diagnostics
        </Button>
      </div>
      {debug && <pre className="text-xs text-muted-foreground max-w-sm overflow-auto mt-4 p-2 bg-muted rounded">{debug}</pre>}
    </div>
  );
}
