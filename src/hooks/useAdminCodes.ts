import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * The connection codes this manager owns.
 *
 * Codes live on both `devices` and `driver_connections`, and nearly every
 * admin query needs the union of the two, so it is resolved once here rather
 * than re-derived (inconsistently) on each screen.
 */
export function useAdminCodes() {
  const { user } = useAuth();
  const [codes, setCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setCodes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [devicesRes, connectionsRes] = await Promise.all([
        supabase
          .from('devices')
          .select('connection_code')
          .eq('user_id', user.id)
          .not('connection_code', 'is', null),
        supabase
          .from('driver_connections')
          .select('connection_code')
          .eq('admin_user_id', user.id)
          .not('connection_code', 'is', null),
      ]);

      const unique = new Set<string>();
      devicesRes.data?.forEach((d) => d.connection_code && unique.add(d.connection_code));
      connectionsRes.data?.forEach((c) => c.connection_code && unique.add(c.connection_code));
      setCodes([...unique]);
    } catch (err) {
      console.error('[useAdminCodes] failed to load connection codes:', err);
      setCodes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  return { codes, loading, refetch: load };
}
