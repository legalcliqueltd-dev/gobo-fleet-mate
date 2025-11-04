import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';

const HealthCheck = () => {
  const [supabaseStatus, setSupabaseStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [mapboxStatus, setMapboxStatus] = useState<'present' | 'missing'>('missing');

  useEffect(() => {
    const checkSupabase = async () => {
      try {
        // Simple connection test - just check if we can reach Supabase
        const { data, error } = await supabase.auth.getSession();
        setSupabaseStatus(!error ? 'connected' : 'error');
      } catch {
        setSupabaseStatus('error');
      }
    };

    const checkMapbox = () => {
      setMapboxStatus(import.meta.env.VITE_MAPBOX_TOKEN ? 'present' : 'missing');
    };

    checkSupabase();
    checkMapbox();
  }, []);

  return (
    <div className="fixed bottom-4 right-4 bg-card/80 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg text-xs z-50">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {supabaseStatus === 'checking' && <AlertCircle className="w-3 h-3 text-muted-foreground animate-pulse" />}
          {supabaseStatus === 'connected' && <CheckCircle className="w-3 h-3 text-green-500" />}
          {supabaseStatus === 'error' && <XCircle className="w-3 h-3 text-destructive" />}
          <span className="text-muted-foreground">Supabase: <span className="text-foreground font-medium">{supabaseStatus}</span></span>
        </div>
        <div className="flex items-center gap-2">
          {mapboxStatus === 'present' ? <CheckCircle className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-destructive" />}
          <span className="text-muted-foreground">Mapbox: <span className="text-foreground font-medium">{mapboxStatus}</span></span>
        </div>
      </div>
    </div>
  );
};

export default HealthCheck;
