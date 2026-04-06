import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { detectNativePlatform, isAndroid, isIOS } from '@/utils/platformDetection';
import { isGeolocationPluginAvailable, isAnyGeolocationAvailable, shouldUseNativeOnly } from '@/utils/nativeGeolocation';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

type LogEntry = { time: string; label: string; value: string; ok: boolean };

export default function LocationDiagnostics() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const navigate = useNavigate();

  const log = (label: string, value: string, ok: boolean) => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, label, value, ok }]);
  };

  const runAll = async () => {
    setLogs([]);
    setRunning(true);

    // 1. Platform detection
    const isNative = detectNativePlatform();
    const platform = Capacitor.getPlatform();
    const android = isAndroid();
    const ios = isIOS();
    log('Platform', `native=${isNative} platform=${platform} android=${android} ios=${ios}`, true);

    // 2. Plugin availability
    const pluginAvail = Capacitor.isPluginAvailable('Geolocation');
    const helperAvail = isGeolocationPluginAvailable();
    const anyAvail = isAnyGeolocationAvailable();
    const nativeOnly = shouldUseNativeOnly();
    log('Plugin Available', `Capacitor.isPluginAvailable=${pluginAvail} helper=${helperAvail} any=${anyAvail} nativeOnly=${nativeOnly}`, pluginAvail || helperAvail);

    // 3. Window.Capacitor bridge check
    try {
      const cap = (window as any).Capacitor;
      const hasPlugins = !!cap?.Plugins?.Geolocation;
      log('Bridge Check', `window.Capacitor exists=${!!cap} Plugins.Geolocation=${hasPlugins}`, hasPlugins);
    } catch (e: any) {
      log('Bridge Check', `Error: ${e?.message || e}`, false);
    }

    // 4. Native checkPermissions
    try {
      const status = await Geolocation.checkPermissions();
      const isManifestError = false;
      log('Native checkPermissions', JSON.stringify(status), status.location === 'granted');
    } catch (e: any) {
      const msg = e?.message || String(e);
      const isManifestMissing = msg.includes('Missing the following permissions in AndroidManifest');
      log(
        'Native checkPermissions',
        `ERROR: ${msg}${isManifestMissing ? '\n⚠️ MANIFEST ISSUE: Location permissions are missing from the packaged AndroidManifest.xml. Rebuild after: npm run build && npx cap sync android' : ''}`,
        false
      );
    }

    // 5. Native requestPermissions
    try {
      const result = await Geolocation.requestPermissions();
      log('Native requestPermissions', JSON.stringify(result), result.location === 'granted' || result.coarseLocation === 'granted');
    } catch (e: any) {
      const msg = e?.message || String(e);
      const isManifestMissing = msg.includes('Missing the following permissions in AndroidManifest');
      log(
        'Native requestPermissions',
        `ERROR: ${msg}${isManifestMissing ? '\n⚠️ MANIFEST ISSUE: Permissions not in manifest. Rebuild required.' : ''}`,
        false
      );
    }

    // 6. Re-check after request
    try {
      const recheck = await Geolocation.checkPermissions();
      log('Native checkPermissions (after)', JSON.stringify(recheck), recheck.location === 'granted');
    } catch (e: any) {
      log('Native checkPermissions (after)', `ERROR: ${e?.message || e}`, false);
    }

    // 7. Native getCurrentPosition
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
      log('Native getCurrentPosition', `lat=${pos.coords.latitude} lng=${pos.coords.longitude} acc=${pos.coords.accuracy}`, true);
    } catch (e: any) {
      log('Native getCurrentPosition', `ERROR: ${e?.message || e}`, false);
    }

    // 8. Browser geolocation — separate section
    log('--- Browser/WebView ---', `(separate from native Capacitor)`, true);

    try {
      const hasBrowser = typeof navigator !== 'undefined' && !!navigator.geolocation;
      log('navigator.geolocation', `exists=${hasBrowser}`, hasBrowser);

      if (hasBrowser && navigator.permissions?.query) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        log('navigator.permissions', `state=${perm.state}`, perm.state === 'granted');
      }

      // Warn if native Android is incorrectly using browser fallback
      if (isNative && android && hasBrowser && !pluginAvail) {
        log(
          '⚠️ Android Fallback Warning',
          'Native Android detected but Capacitor Geolocation plugin is unavailable. The app would fall back to browser geolocation which bypasses native permissions. This indicates a build/manifest issue.',
          false
        );
      }

      if (isNative && android && pluginAvail) {
        log(
          'Android Geolocation Source',
          'Using native Capacitor Geolocation plugin (correct). Browser geolocation is disabled on native Android.',
          true
        );
      }
    } catch (e: any) {
      log('Browser Geolocation', `ERROR: ${e?.message || e}`, false);
    }

    setRunning(false);
  };

  const runSingle = async (step: string) => {
    try {
      if (step === 'check') {
        const s = await Geolocation.checkPermissions();
        log('checkPermissions', JSON.stringify(s), s.location === 'granted');
      } else if (step === 'request') {
        const r = await Geolocation.requestPermissions();
        log('requestPermissions', JSON.stringify(r), r.location === 'granted' || r.coarseLocation === 'granted');
      } else if (step === 'position') {
        const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
        log('getCurrentPosition', `lat=${p.coords.latitude} lng=${p.coords.longitude}`, true);
      }
    } catch (e: any) {
      log(step, `ERROR: ${e?.message || e}`, false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <h1 className="text-xl font-bold text-foreground mb-4">📍 Location Diagnostics</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button onClick={runAll} disabled={running} size="sm">
          {running ? 'Running...' : 'Run All Tests'}
        </Button>
        <Button onClick={() => runSingle('check')} variant="outline" size="sm">
          Check Perms
        </Button>
        <Button onClick={() => runSingle('request')} variant="outline" size="sm">
          Request Perms
        </Button>
        <Button onClick={() => runSingle('position')} variant="outline" size="sm">
          Get Position
        </Button>
      </div>

      <div className="flex gap-2 mb-4">
        <Button onClick={() => setLogs([])} variant="ghost" size="sm">Clear</Button>
        <Button onClick={() => navigate('/app/dashboard')} variant="secondary" size="sm">
          → Dashboard
        </Button>
      </div>

      <div className="space-y-2">
        {logs.length === 0 && (
          <p className="text-muted-foreground text-sm">Tap "Run All Tests" to start diagnostics.</p>
        )}
        {logs.map((entry, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg border text-sm font-mono break-all ${
              entry.ok
                ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span>{entry.ok ? '✅' : '❌'}</span>
              <span className="font-semibold text-foreground">{entry.label}</span>
              <span className="text-muted-foreground text-xs ml-auto">{entry.time}</span>
            </div>
            <div className="text-xs text-muted-foreground whitespace-pre-wrap">{entry.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
