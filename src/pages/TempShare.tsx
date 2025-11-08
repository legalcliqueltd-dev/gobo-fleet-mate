import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Loader2, MapPin, Check, AlertCircle } from 'lucide-react';

type ShareStatus = 'idle' | 'requesting' | 'sharing' | 'stopped' | 'error';

export default function TempShare() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<ShareStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const watchId = useRef<number | null>(null);

  const callTempTrack = async (payload: any) => {
    const { data, error } = await supabase.functions.invoke('temp-track', {
      body: payload
    });
    
    if (error) throw error;
    if (!data?.ok && data?.error) throw new Error(data.error);
    return data;
  };

  const claim = async () => {
    if (!token) return;
    await callTempTrack({ 
      action: 'claim', 
      token, 
      nickname: nickname.trim() || undefined 
    });
  };

  const startSharing = async () => {
    try {
      setStatus('requesting');
      setError(null);
      
      await claim();

      if (!('geolocation' in navigator)) {
        throw new Error('Geolocation not supported by your device');
      }

      watchId.current = navigator.geolocation.watchPosition(
        async (pos) => {
          try {
            const { latitude, longitude, speed } = pos.coords;
            await callTempTrack({
              action: 'update',
              token,
              coords: {
                latitude,
                longitude,
                speed: typeof speed === 'number' ? speed * 3.6 : null, // m/s -> km/h
                timestamp: pos.timestamp
              }
            });
            if (status !== 'sharing') setStatus('sharing');
          } catch (e: any) {
            console.error('Location update failed:', e);
            setError(e.message ?? 'Update failed');
          }
        },
        (err) => {
          console.error('Geolocation error:', err);
          setError(err?.message || 'Location error');
          setStatus('error');
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 15000
        }
      );

    } catch (e: any) {
      console.error('Failed to start sharing:', e);
      setStatus('error');
      setError(e?.message || 'Failed to start sharing');
    }
  };

  const stopSharing = async () => {
    try {
      await callTempTrack({ action: 'stop', token });
    } catch (e) {
      console.error('Failed to stop session:', e);
    }
    
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setStatus('stopped');
  };

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-cyan-500/10 to-indigo-800/10 dark:from-[#0b1220] dark:to-[#0f172a]">
        <Card className="max-w-md w-full p-6 text-center shadow-lg">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Invalid Link</h1>
          <p className="text-muted-foreground mb-4">
            This tracking link is invalid or has expired.
          </p>
          <Button onClick={() => window.location.href = '/'}>
            Go Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-cyan-500/10 to-indigo-800/10 dark:from-[#0b1220] dark:to-[#0f172a]">
      {/* Minimal header for guest */}
      <div className="w-full max-w-md mb-6 text-center">
        <div className="inline-flex items-center gap-2 font-heading font-semibold tracking-tight text-xl">
          <span className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-white dark:bg-slate-900 text-cyan-700 dark:text-cyan-300 border-2 border-slate-200 dark:border-slate-800">
            <MapPin className="h-5 w-5" />
          </span>
          <span>FleetTrackMate</span>
        </div>
      </div>

      <Card className="max-w-md w-full p-6 shadow-lg">
        <div className="text-center mb-6">
          <MapPin className="w-12 h-12 text-primary mx-auto mb-4" />
          <h1 className="text-2xl font-semibold mb-2">Share Your Location</h1>
          <p className="text-sm text-muted-foreground">
            By continuing, you consent to share your live location temporarily with the requester.
          </p>
        </div>

        {status === 'idle' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium mb-2">
                Nickname (optional)
              </label>
              <Input
                id="nickname"
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Enter your name"
              />
            </div>
            <Button onClick={startSharing} className="w-full">
              Start Sharing
            </Button>
          </div>
        )}

        {status === 'requesting' && (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">Setting up tracking...</p>
          </div>
        )}

        {status === 'sharing' && (
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
              <Check className="w-8 h-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
                Live Updates Active
              </p>
              <p className="text-xs text-green-700 dark:text-green-300">
                Keep this page open. Your location is being shared.
              </p>
            </div>
            <Button
              onClick={stopSharing}
              variant="destructive"
              className="w-full"
            >
              Stop Sharing
            </Button>
          </div>
        )}

        {status === 'stopped' && (
          <div className="text-center space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-4">
              <Check className="w-8 h-8 text-slate-600 dark:text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-medium mb-1">Sharing Stopped</p>
              <p className="text-xs text-muted-foreground">
                You are no longer sharing your location.
              </p>
            </div>
            <Button onClick={() => window.close()} variant="outline" className="w-full">
              Close
            </Button>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center space-y-4">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
              <AlertCircle className="w-8 h-8 text-destructive mx-auto mb-2" />
              <p className="text-sm font-medium text-destructive mb-1">Error</p>
              <p className="text-xs text-muted-foreground">
                {error || 'Something went wrong'}
              </p>
            </div>
            <Button onClick={() => window.location.href = '/'} variant="outline" className="w-full">
              Go Home
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
