import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import DriverHistoryView from '@/components/history/DriverHistoryView';

/** Driver movement history on the website — same view as the app, wider. */
export default function DriverHistory() {
  const { driverId } = useParams<{ driverId: string }>();
  const [name, setName] = useState('Driver');

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
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Link
        to={`/driver/${driverId}`}
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to driver
      </Link>

      <div className="mb-4">
        <p className="eyebrow mb-1">Movement history</p>
        <h1 className="font-heading text-2xl font-bold tracking-tight">{name}</h1>
      </div>

      <DriverHistoryView driverId={driverId} driverName={name} />
    </div>
  );
}
