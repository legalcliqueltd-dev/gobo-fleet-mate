import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Check, AlertCircle, User } from 'lucide-react';
import { toast } from 'sonner';

export default function ConnectDevice() {
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
  const [existingConnection, setExistingConnection] = useState<{ code: string; deviceName: string } | null>(null);
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
        setExistingConnection({
          code: '',
          deviceName: data.device.name || 'Device',
        });
        // If user is already connected, show success state
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
      navigate('/auth/login');
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
        navigate('/auth/login');
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
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (connected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-background/50 backdrop-blur border border-border">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-success-foreground" />
            </div>
            
            <h2 className="text-2xl font-bold">Connected!</h2>
            
            <p className="text-muted-foreground">
              You are connected to <span className="font-semibold">{deviceName}</span>
            </p>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm">
              <p className="font-semibold mb-2">Next Steps:</p>
              <ol className="text-left space-y-1 text-muted-foreground list-decimal list-inside">
                <li>Go to the Driver Dashboard</li>
                <li>Toggle "On Duty" to start tracking</li>
                <li>Your location will sync in real-time</li>
              </ol>
            </div>

            <Button onClick={() => navigate('/driver')} className="w-full">
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-background/50 backdrop-blur border border-border">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Connect to Device</h2>
            <p className="text-sm text-muted-foreground">
              Enter the connection code from your admin to link your driver app.
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
              <p className="text-xs text-muted-foreground mt-1">
                This name will be visible to your admin
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Connection Code</label>
              <Input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="Enter 8-character code"
                maxLength={8}
                className="text-center text-2xl tracking-wider font-mono"
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
            >
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
          </div>

          <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 text-sm">
            <p className="font-semibold mb-1 text-warning">Note:</p>
            <p className="text-muted-foreground">
              Each code can only be used by one driver. If this code is already in use, contact your admin.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
