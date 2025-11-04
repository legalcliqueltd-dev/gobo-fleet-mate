import { Marker } from 'react-map-gl';
import { Car } from 'lucide-react';

type Props = {
  latitude: number;
  longitude: number;
  speed: number | null;
  name: string | null;
  status: 'active' | 'idle' | 'offline' | null;
};

export default function DeviceMarker({ latitude, longitude, status }: Props) {
  const statusColor = (s: typeof status) =>
    s === 'active' ? 'bg-emerald-500' : s === 'idle' ? 'bg-amber-500' : 'bg-slate-400';

  return (
    <Marker longitude={longitude} latitude={latitude} anchor="bottom">
      <div className="relative -translate-y-1">
        <div className={`h-3 w-3 rounded-full ring-2 ring-white/80 dark:ring-black/40 ${statusColor(status)} absolute -top-1 -right-1`}></div>
        <div className="grid place-items-center h-7 w-7 rounded-full bg-white/90 dark:bg-slate-900/90 shadow">
          <Car className="h-4 w-4 text-cyan-600" />
        </div>
      </div>
    </Marker>
  );
}
