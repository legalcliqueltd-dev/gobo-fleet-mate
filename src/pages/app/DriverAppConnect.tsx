import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Check, AlertCircle, User } from 'lucide-react';
import { toast } from 'sonner';
import logo from '@/assets/logo.webp';

export default function DriverAppConnect() {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState(codeFromUrl || '');
  const [driverName, setDriverName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string>('');
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    checkExistingConnection();
  }, [user]);

  const checkExistingConnection = async () => {
    if (!user) {
      setCheckingExisting(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: { action: 'get-connection' },
      });

      if (!error && data.connected && data.device) {
        setConnected(true);
        setDeviceName(data.device.name || 'Device');
      }
    } catch (err) {
      console.error('Error checking connection:', err);
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleConnect = async () => {
    if (!user) {
      toast.error('Please log in first');
      navigate('/app/login');
      return;
    }

    if (!code.trim()) {
      setError('Please enter a connection code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        setError('Session expired. Please log in again.');
        toast.error('Session expired');
        navigate('/app/login');
        return;
      }

      const { data, error: functionError } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'connect',
          code: code.trim().toUpperCase(),
          driverName: driverName.trim() || undefined,
        },
      });

      if (functionError) throw functionError;

      if (data.error) {
        setError(data.error);
        toast.error(data.error);
      } else if (data.success) {
        setConnected(true);
        setDeviceName(data.device?.name || 'Device');
        toast.success('Successfully connected!');
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect');
      toast.error('Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  if (checkingExisting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold">Connected!</h2>
            
            <p className="text-muted-foreground">
              You are connected to <span className="font-semibold">{deviceName}</span>
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
              Enter the connection code from your admin
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Enter your name"
                  className="pl-10"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Connection Code</label>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="XXXXXXXX"
                maxLength={8}
                className="text-center text-2xl tracking-widest font-mono"
                disabled={loading}
              />
              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive mt-2">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>

            <Button
              onClick={handleConnect}
              disabled={loading || !code.trim()}
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
