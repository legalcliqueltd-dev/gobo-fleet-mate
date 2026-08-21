import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import DriverHistoryView from '@/components/history/DriverHistoryView';

/** A driver's day-by-day movement history, in the manager portal. */
export default function AdminAppDriverHistory() {
  const { driverId } = useParams<{ driverId: string }>();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    if (!driverId) return;
    void supabase
      .from('drivers')
      .select('driver_name')
      .eq('driver_id', driverId)
      .maybeSingle()
      .then(({ data }) => setName(data?.driver_name?.trim() || 'Driver'));
  }, [driverId]);

  if (!driverId) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        <button
          type="button"
          onClick={() => navigate(`/app/admin/drivers/${driverId}`)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Back to driver"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="truncate text-sm font-semibold">
          {name ?? <Loader2 className="h-4 w-4 animate-spin" />}
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <DriverHistoryView driverId={driverId} driverName={name ?? 'This driver'} />
      </div>
    </div>
  );
}
