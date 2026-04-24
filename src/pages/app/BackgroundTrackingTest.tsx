import { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Database, Lock, Play, RefreshCw, RotateCcw, Timer, WifiOff } from 'lucide-react';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { useTrackingService } from '@/hooks/useTrackingService';
import { trackingService } from '@/services/trackingService';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'running' | 'checking' | 'passed' | 'failed';

type Snapshot = {
  count: number;
  locations: number;
  enabled: boolean;
  isMoving: boolean;
  authorization?: string | number | null;
  providerEnabled?: boolean;
};

const STORAGE_KEY = 'ftm_ios_background_test';
const DURATIONS = [60, 90, 120];

const loadBackgroundGeolocation = async () => {
  const mod = await import('@transistorsoft/capacitor-background-geolocation');
  return (mod as any).default ?? mod;
};

const getSnapshot = async (): Promise<Snapshot> => {
  const BG = await loadBackgroundGeolocation();
  const [count, locations, state, provider] = await Promise.all([
    BG.getCount().catch(() => 0),
    BG.getLocations().catch(() => []),
    BG.getState().catch(() => null),
    BG.getProviderState().catch(() => null),
  ]);

  return {
    count: typeof count === 'number' ? count : 0,
    locations: Array.isArray(locations) ? locations.length : 0,
    enabled: !!state?.enabled,
    isMoving: !!state?.isMoving,
    authorization: provider?.status ?? provider?.authorizationStatus ?? state?.authorization ?? null,
    providerEnabled: provider?.enabled,
  };
};

export default function BackgroundTrackingTest() {
  const { session } = useDriverSession();
  const trackingState = useTrackingService();
  const isNativeIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  const [duration, setDuration] = useState(90);
  const [phase, setPhase] = useState<Phase>('idle');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<Snapshot | null>(null);
  const [result, setResult] = useState<Snapshot | null>(null);
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(Date.now());

  const elapsedSeconds = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
  const remainingSeconds = Math.max(0, duration - elapsedSeconds);
  const progress = startedAt ? Math.min(100, Math.round((elapsedSeconds / duration) * 100)) : 0;

  const queueDelta = useMemo(() => {
    if (!baseline || !result) return null;
    return Math.max(result.count - baseline.count, result.locations - baseline.locations);
  }, [baseline, result]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed?.phase === 'running' && parsed?.startedAt && parsed?.baseline) {
        setDuration(parsed.duration || 90);
        setStartedAt(parsed.startedAt);
        setBaseline(parsed.baseline);
        setPhase('running');
        setMessage('Test restored. If the phone was locked long enough, tap Verify Now.');
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    const refresh = () => setNow(Date.now());
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [phase]);

  useEffect(() => {
    if (phase === 'running' && startedAt && elapsedSeconds >= duration) {
      verifyTest();
    }
  }, [phase, startedAt, elapsedSeconds, duration]);

  const startTest = async () => {
    setMessage('');
    setResult(null);

    if (!isNativeIOS) {
      setPhase('failed');
      setMessage('This test must run inside the native iOS driver app.');
      return;
    }

    if (!session?.driverId || !session?.adminCode) {
      setPhase('failed');
      setMessage('Connect as a driver before running this test.');
      return;
    }

    setPhase('checking');
    try {
      await trackingService.start(session.driverId, session.adminCode);
      const BG = await loadBackgroundGeolocation();
      await BG.start().catch(() => undefined);
      if (typeof BG.changePace === 'function') await BG.changePace(true).catch(() => undefined);

      const snapshot = await getSnapshot();
      const start = Date.now();
      setBaseline(snapshot);
      setStartedAt(start);
      setNow(start);
      setPhase('running');
      setMessage('Lock the iPhone now, keep Airplane Mode on, move for the selected time, then unlock and return here.');
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ phase: 'running', startedAt: start, duration, baseline: snapshot }));
    } catch (error: any) {
      setPhase('failed');
      setMessage(`Unable to start native tracker: ${error?.message || error}`);
    }
  };

  const verifyTest = async () => {
    if (!baseline || !startedAt) return;
    if (Math.floor((Date.now() - startedAt) / 1000) < 60) {
      setMessage('Wait at least 60 seconds before verifying.');
      return;
    }

    setPhase('checking');
    try {
      const snapshot = await getSnapshot();
      const delta = Math.max(snapshot.count - baseline.count, snapshot.locations - baseline.locations);
      setResult(snapshot);
      localStorage.removeItem(STORAGE_KEY);
      setPhase(delta > 0 ? 'passed' : 'failed');
      setMessage(
        delta > 0
          ? `Pass: native SQLite queue increased by ${delta} record${delta === 1 ? '' : 's'}.`
          : 'No new native SQLite records were found. Keep Airplane Mode on, confirm Location is set to Always, then test again while walking or driving.'
      );
    } catch (error: any) {
      setPhase('failed');
      setMessage(`Unable to read native SQLite queue: ${error?.message || error}`);
    }
  };

  const resetTest = () => {
    localStorage.removeItem(STORAGE_KEY);
    setPhase('idle');
    setStartedAt(null);
    setBaseline(null);
    setResult(null);
    setMessage('');
    setNow(Date.now());
  };

  return (
    <DriverAppLayout>
      <div className="p-4 space-y-4 pb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Background Tracking Test</h1>
          <p className="text-sm text-muted-foreground mt-1">Verify iOS native background location records are queued while the phone is locked.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><WifiOff className="h-5 w-5" /> Before you start</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Enable Airplane Mode so native HTTP sync cannot flush the SQLite queue during the test.</p>
            <p>Set Location permission to Always, keep tracking On Duty, then move outside for best GPS updates.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><Timer className="h-5 w-5" /> Test window</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map((seconds) => (
                <Button key={seconds} type="button" variant={duration === seconds ? 'default' : 'outline'} disabled={phase === 'running' || phase === 'checking'} onClick={() => setDuration(seconds)}>
                  {seconds}s
                </Button>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <span className={cn('font-semibold', phase === 'passed' && 'text-success', phase === 'failed' && 'text-destructive', phase === 'running' && 'text-warning')}>
                  {phase === 'idle' ? 'Ready' : phase === 'checking' ? 'Checking' : phase === 'running' ? `${remainingSeconds}s left` : phase === 'passed' ? 'Passed' : 'Failed'}
                </span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Tracking" value={trackingState.isTracking ? 'Active' : 'Stopped'} tone={trackingState.isTracking ? 'good' : 'muted'} />
              <Metric label="Elapsed" value={`${elapsedSeconds}s`} />
              <Metric label="Start queue" value={baseline ? `${baseline.count}` : '—'} />
              <Metric label="End queue" value={result ? `${result.count}` : '—'} tone={queueDelta && queueDelta > 0 ? 'good' : 'muted'} />
            </div>

            {message && (
              <div className={cn('rounded-lg border p-3 text-sm', phase === 'passed' ? 'border-success/30 bg-success/10 text-success' : phase === 'failed' ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-border bg-muted/30 text-muted-foreground')}>
                {message}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={startTest} disabled={phase === 'running' || phase === 'checking'}>
                <Play className="h-4 w-4 mr-2" /> Start Test
              </Button>
              <Button onClick={verifyTest} variant="secondary" disabled={!baseline || phase === 'checking'}>
                <RefreshCw className="h-4 w-4 mr-2" /> Verify Now
              </Button>
              <Button onClick={resetTest} variant="ghost">
                <RotateCcw className="h-4 w-4 mr-2" /> Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {phase === 'running' && (
          <Card className="border-warning/30 bg-warning/10">
            <CardContent className="p-4 flex items-start gap-3">
              <Lock className="h-5 w-5 text-warning mt-0.5" />
              <div className="text-sm text-warning space-y-1">
                <p className="font-semibold">Lock the iPhone now.</p>
                <p>Keep it locked until the selected time has passed, then unlock and this screen will verify the native SQLite queue.</p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2"><Database className="h-5 w-5" /> Native details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            <p>Platform: {Capacitor.getPlatform()} {Capacitor.isNativePlatform() ? 'native' : 'web'}</p>
            <p>Baseline locations: {baseline ? baseline.locations : '—'}</p>
            <p>Result locations: {result ? result.locations : '—'}</p>
            <p>Authorization: {String(result?.authorization ?? baseline?.authorization ?? '—')}</p>
            <p>Provider enabled: {String(result?.providerEnabled ?? baseline?.providerEnabled ?? '—')}</p>
          </CardContent>
        </Card>
      </div>
    </DriverAppLayout>
  );
}

function Metric({ label, value, tone = 'muted' }: { label: string; value: string; tone?: 'good' | 'muted' }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-muted-foreground">{label}</div>
      <div className={cn('text-lg font-semibold tabular-nums text-foreground', tone === 'good' && 'text-success')}>{value}</div>
    </div>
  );
}