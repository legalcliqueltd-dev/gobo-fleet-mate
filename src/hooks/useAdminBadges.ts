import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminCodes } from '@/hooks/useAdminCodes';

/**
 * Counts of things waiting on the manager.
 *
 * Without these the Insights cards all look identical, so a fuel claim sitting
 * unapproved for a week and a brake fault reported this morning are equally
 * invisible until someone happens to open the right screen. A dot is the
 * cheapest way to make "this one needs you" survive a glance.
 */
export function useAdminBadges() {
  const { codes, loading: codesLoading } = useAdminCodes();
  const [pendingExpenses, setPendingExpenses] = useState(0);
  const [openReports, setOpenReports] = useState(0);

  const load = useCallback(async () => {
    if (codes.length === 0) {
      setPendingExpenses(0);
      setOpenReports(0);
      return;
    }

    const db = supabase as unknown as { from: (t: string) => any };

    // Both tables may not exist yet on a deployment whose migrations have not
    // been run; a missing badge must never take the screen down.
    try {
      const { count } = await db
        .from('driver_expenses')
        .select('id', { count: 'exact', head: true })
        .in('admin_code', codes)
        .eq('status', 'submitted');
      setPendingExpenses(count ?? 0);
    } catch {
      setPendingExpenses(0);
    }

    try {
      const { count } = await db
        .from('driver_reports')
        .select('id', { count: 'exact', head: true })
        .in('admin_code', codes)
        .neq('status', 'resolved');
      setOpenReports(count ?? 0);
    } catch {
      setOpenReports(0);
    }
  }, [codes]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  return { pendingExpenses, openReports, refresh: load };
}
