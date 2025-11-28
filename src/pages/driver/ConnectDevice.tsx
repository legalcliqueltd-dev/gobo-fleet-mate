import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ConnectDevice() {
  const [searchParams] = useSearchParams();
  const codeFromUrl = searchParams.get('code');
  
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState(codeFromUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState<string>('');

  const handleConnect = async () => {
    console.log('=== CONNECT BUTTON CLICKED ===');
    console.log('User:', user?.id, user?.email);
    
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
      // Get current session to verify we have a valid token
      const { data: sessionData } = await supabase.auth.getSession();
      console.log('Session exists:', !!sessionData.session);
      console.log('Access token length:', sessionData.session?.access_token?.length);
      
      if (!sessionData.session) {
        setError('Session expired. Please log in again.');
        toast.error('Session expired. Please log in again.');
        navigate('/auth/login');
        return;
      }

      console.log('Calling connect-driver with code:', code.trim().toUpperCase());
      
      const { data, error: functionError } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'connect',
          code: code.trim().toUpperCase(),
        },
      });

      console.log('Function response:', data);
      console.log('Function error:', functionError);

      if (functionError) {
        throw functionError;
      }

      if (data.error) {
        setError(data.error);
        toast.error(data.error);
      } else if (data.success) {
        setConnected(true);
        setDeviceName(data.device?.name || 'Device');
        toast.success('Successfully connected to device!');
      }
    } catch (err: any) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect to device');
      toast.error('Failed to connect to device');
    } finally {
      setLoading(false);
    }
  };

  if (connected) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card variant="glass" className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-4">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-white" />
            </div>
            
            <h2 className="text-2xl font-bold">Connected Successfully!</h2>
            
            <p className="text-muted-foreground">
              You are now connected to <span className="font-semibold">{deviceName}</span>
            </p>

            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
              <p className="font-semibold mb-2">Next Steps:</p>
              <ol className="text-left space-y-1 text-muted-foreground list-decimal list-inside">
                <li>Go to the Driver Dashboard</li>
                <li>Toggle "On Duty" to start tracking</li>
                <li>Your location will sync with the admin in real-time</li>
              </ol>
            </div>

            <Button
              onClick={() => navigate('/driver')}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card variant="glass" className="max-w-md w-full">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Link2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Connect to Device</h2>
            <p className="text-sm text-muted-foreground">
              Enter the connection code provided by your admin to link your driver app to their tracking system.
            </p>
          </div>

          <div className="space-y-4">
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
                <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
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
              {loading ? 'Connecting...' : 'Connect Device'}
            </Button>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm">
            <p className="font-semibold mb-1">Note:</p>
            <p className="text-muted-foreground">
              Once connected, your location will be tracked and visible to the admin when you toggle "On Duty" in the driver dashboard.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}