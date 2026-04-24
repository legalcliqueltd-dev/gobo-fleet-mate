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
import logo from '@/assets/logo.png';
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
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-[hsl(var(--success))] rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-[hsl(var(--success-foreground))]" />
            </div>
            
            <h2 className="text-2xl font-bold">Connected!</h2>
            
            <p className="text-muted-foreground">
              Welcome, <span className="font-semibold">{driverName}</span>! You're connected to{' '}
              <span className="font-semibold">{deviceName}</span>
            </p>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm">
              <p className="font-semibold mb-2">Next Steps:</p>
              <ol className="text-left space-y-1 text-muted-foreground list-decimal list-inside">
                <li>Go to the Dashboard</li>
                <li>Toggle "On Duty" to start tracking</li>
                <li>Your location will sync in real-time</li>
              </ol>
            </div>

            <Button onClick={() => navigate('/app/dashboard')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <img src={logo} alt="FleetTrackMate" className="h-16 w-16 rounded-xl mb-3" />
        <h1 className="text-xl font-heading font-semibold">FleetTrackMate Driver</h1>
      </div>

      <Card className="max-w-md w-full">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 className="h-7 w-7 text-primary" />
            </div>
            <h2 className="text-xl font-bold mb-2">Connect to Fleet</h2>
            <p className="text-sm text-muted-foreground">
              Enter your name and the connection code from your admin
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Name *</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={driverName}
                  onChange={(e) => {
                    setDriverName(e.target.value);
                    setError(null);
                  }}
                  placeholder="Enter your name"
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Connection Code *</label>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                  setFailCount(0);
                }}
                placeholder="XXXXXXXX"
                maxLength={8}
                className={cn(
                  "text-center text-2xl tracking-widest font-mono",
                  shakeInput && "animate-shake"
                )}
                disabled={loading}
              />
              {error && (
                <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                  {failCount >= 3 && (
                    <p className="text-xs text-muted-foreground mt-2 pl-6">
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
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground">
            Don't have a code? Contact your fleet administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
