import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { MapPin, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

type TrackingState = 'idle' | 'claiming' | 'active' | 'stopped' | 'error';

export default function TempShare() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<TrackingState>('idle');
  const [nickname, setNickname] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  const claimSession = async () => {
    if (!token) return;

    setState('claiming');
    setError(null);

    try {
      const { data, error } = await supabase.functions.invoke('temp-track', {
        body: {
          action: 'claim',
          token,
          nickname: nickname.trim() || null,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (!data.ok) throw new Error('Failed to claim session');

      toast.success('Location sharing started');
      setState('active');
      startTracking();
    } catch (err: any) {
      console.error('Failed to claim session:', err);
      setError(err.message || 'Failed to start tracking');
      setState('error');
      toast.error('Failed to start tracking');
    }
  };

  const startTracking = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported');
      setState('error');
      return;
    }

    // Request permission and start watching
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        sendLocationUpdate(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.speed
        );
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError(`Location error: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    watchIdRef.current = watchId;

    // Also send updates every 30 seconds
    updateIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          sendLocationUpdate(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.speed
          );
        },
        (err) => console.error('Position update error:', err)
      );
    }, 30000);
  };

  const sendLocationUpdate = async (
    latitude: number,
    longitude: number,
    speed: number | null
  ) => {
    if (!token || state !== 'active') return;

    try {
      const speedKmh = speed !== null ? speed * 3.6 : null;
      
      const { data, error } = await supabase.functions.invoke('temp-track', {
        body: {
          action: 'update',
          token,
          coords: {
            latitude,
            longitude,
            speed: speedKmh,
            timestamp: new Date().toISOString(),
          },
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);
      if (!data.ok) throw new Error('Failed to update location');

      setLastUpdate(new Date());
    } catch (err: any) {
      console.error('Failed to send location update:', err);
      if (err.message?.includes('expired') || err.message?.includes('revoked')) {
        stopTracking();
        setState('stopped');
        setError('Tracking session has ended');
      }
    }
  };

  const stopTracking = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    if (token && state === 'active') {
      try {
        await supabase.functions.invoke('temp-track', {
          body: { action: 'stop', token },
        });
      } catch (err) {
        console.error('Failed to stop session:', err);
      }
    }

    setState('stopped');
    toast.info('Location sharing stopped');
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <h2 className="text-xl font-semibold">Invalid Link</h2>
            <p className="text-muted-foreground">
              This tracking link is invalid or malformed.
            </p>
            <Button onClick={() => navigate('/')}>Go to Home</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-6">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Share Your Location</h1>
            <p className="text-muted-foreground">
              Someone has requested to temporarily track your location
            </p>
          </div>

          {state === 'idle' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nickname">Your Name (Optional)</Label>
                <Input
                  id="nickname"
                  placeholder="e.g., John Doe"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                <h3 className="font-semibold text-sm">What gets shared:</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Your real-time location</li>
                  <li>• Your movement speed</li>
                  <li>• Updates every 30 seconds</li>
                </ul>
              </div>

              <Button onClick={claimSession} className="w-full" size="lg">
                Start Sharing Location
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                You can stop sharing at any time. This link will expire automatically.
              </p>
            </div>
          )}

          {state === 'claiming' && (
            <div className="flex flex-col items-center space-y-4 py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Starting location sharing...</p>
            </div>
          )}

          {state === 'active' && (
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-2 py-4">
                <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></div>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Location Sharing Active
                </p>
              </div>

              {lastUpdate && (
                <p className="text-xs text-center text-muted-foreground">
                  Last update: {lastUpdate.toLocaleTimeString()}
                </p>
              )}

              <Button onClick={stopTracking} variant="destructive" className="w-full" size="lg">
                Stop Sharing
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                Keep this page open while sharing your location
              </p>
            </div>
          )}

          {state === 'stopped' && (
            <div className="flex flex-col items-center space-y-4 py-8">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground" />
              <p className="text-center text-muted-foreground">
                Location sharing has stopped
              </p>
              <Button onClick={() => navigate('/')} variant="outline">
                Close
              </Button>
            </div>
          )}

          {state === 'error' && error && (
            <div className="space-y-4">
              <div className="flex flex-col items-center space-y-4 py-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <p className="text-center text-destructive">{error}</p>
              </div>
              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                Go to Home
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
