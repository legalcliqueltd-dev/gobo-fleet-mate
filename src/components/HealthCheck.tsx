import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function HealthCheck() {
  const [status, setStatus] = useState<'ok' | 'warn'>('warn');

  useEffect(() => {
    const run = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error) setStatus('warn');
        else setStatus('ok');
      } catch {
        setStatus('warn');
      }
    };
    run();
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 px-3 py-2 backdrop-blur">
      {status === 'ok' ? (
        <>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span className="text-sm">Supabase connected</span>
        </>
      ) : (
        <>
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <span className="text-sm">Supabase connection issue</span>
        </>
      )}
    </div>
  );
}
