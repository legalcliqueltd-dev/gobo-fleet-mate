import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Check, AlertCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.webp';
import DriverOnboarding, { isOnboardingCompleted } from '@/components/driver/DriverOnboarding';

export default function DriverAppConnect() {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code');
  
  const { connect, isConnected, session } = useDriverSession();
  const navigate = useNavigate();
  const [code, setCode] = useState(codeFromUrl || '');
  const [driverName, setDriverName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string>('');
  const [failCount, setFailCount] = useState(0);
  const [shakeInput, setShakeInput] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // If already connected, redirect to dashboard
  if (isConnected && !connected && !showOnboarding) {
    navigate('/app/dashboard', { replace: true });
    return null;
  }

  const triggerShake = () => {
    setShakeInput(true);
    setTimeout(() => setShakeInput(false), 500);
  };

  const handleConnect = async () => {
    if (!code.trim()) {
      setError('Please enter a connection code');
      return;
    }

    if (!driverName.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call the connect-driver edge function (no auth required)
      const { data, error: functionError } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'connect',
          code: code.trim().toUpperCase(),
          driverName: driverName.trim(),
        },
      });

      if (functionError) throw functionError;

      if (data.error) {
        const newFailCount = failCount + 1;
        setFailCount(newFailCount);
        setError('Incorrect code. Please double-check the code sent to you and try again.');
        triggerShake();
      } else if (data.success && data.driverId) {
        connect(data.driverId, driverName.trim(), code.trim().toUpperCase());
        setConnected(true);
        setDeviceName(data.device?.name || 'Fleet');
        setFailCount(0);
        toast.success('Successfully connected!');
        // Show onboarding if first time
        if (!isOnboardingCompleted()) {
          setShowOnboarding(true);
        }
      } else {
        const newFailCount = failCount + 1;
        setFailCount(newFailCount);
        setError('Incorrect code. Please double-check the code sent to you and try again.');
        triggerShake();
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      const newFailCount = failCount + 1;
      setFailCount(newFailCount);
      setError('Incorrect code. Please double-check the code sent to you and try again.');
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  // Show onboarding
  if (showOnboarding) {
    return <DriverOnboarding onComplete={() => navigate('/app/dashboard', { replace: true })} />;
  }

  if (connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-7 text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success">
              <Check className="h-8 w-8 text-success-foreground" />
            </div>

            <div>
              <h2 className="font-heading text-2xl font-bold">Connected</h2>
              <p className="mt-2 text-muted-foreground">
                Welcome, <span className="font-semibold text-foreground">{driverName}</span>. You're
                linked to <span className="font-semibold text-foreground">{deviceName}</span>.
              </p>
            </div>

            <ol className="space-y-3 rounded-lg border border-border bg-muted/40 p-4 text-left text-sm">
              {[
                'Open the dashboard',
                'Go on duty to start tracking',
                'Your location syncs in real time',
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="font-mono text-xs font-medium text-primary">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>

            <Button onClick={() => navigate('/app/dashboard')} className="w-full" size="lg">
              Open dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Brand */}
      <div className="mb-8 flex flex-col items-center">
        <img src={logo} alt="FleetTrackMate" className="mb-3 h-16 w-16 rounded-xl" />
        <h1 className="font-heading text-xl font-semibold tracking-tight">FleetTrackMate Driver</h1>
        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Live fleet tracking
        </p>
      </div>

      <Card className="max-w-md w-full">
        <CardContent className="space-y-6 p-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent">
              <Link2 className="h-7 w-7 text-accent-foreground" />
            </div>
            <h2 className="mb-1.5 font-heading text-xl font-bold">Connect to your fleet</h2>
            <p className="text-sm text-muted-foreground">
              Enter your name and the connection code from your admin.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="driver-name" className="mb-2 block text-sm font-medium">
                Your name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="driver-name"
                  value={driverName}
                  onChange={(e) => {
                    setDriverName(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter your name"
                  className="h-12 pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="connection-code" className="mb-2 block text-sm font-medium">
                Connection code
              </label>
              <Input
                id="connection-code"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                  setFailCount(0);
                }}
                placeholder="XXXXXXXX"
                maxLength={8}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                className={cn(
                  'h-14 bg-muted/40 text-center font-mono text-2xl font-semibold uppercase tracking-[0.35em]',
                  shakeInput && 'animate-shake'
                )}
                disabled={loading}
              />
              {error && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                  {failCount >= 3 && (
                    <p className="mt-2 pl-6 text-xs text-muted-foreground">
                      Still having trouble? Contact your dispatcher for a new code.
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button
              onClick={handleConnect}
              disabled={loading || !code.trim() || !driverName.trim()}
              className="w-full"
              size="lg"
            >
              {loading ? 'Connecting…' : 'Connect'}
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            No code yet? Ask your fleet administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
