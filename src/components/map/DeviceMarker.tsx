import { Marker } from 'react-map-gl';
import { Car } from 'lucide-react';
import clsx from 'clsx';

type Props = {
  latitude: number;
  longitude: number;
  name?: string | null;
  speed?: number | null;
  status?: 'active' | 'idle' | 'offline' | null;
  onClick?: () => void;
};

const statusColor: Record<string, string> = {
  active: 'bg-emerald-500',
  idle: 'bg-amber-500',
  offline: 'bg-slate-400',
};
const ringColor: Record<string, string> = {
  active: 'ring-emerald-400/60',
  idle: 'ring-amber-400/60',
  offline: 'ring-slate-400/50',
};

export default function DeviceMarker({ latitude, longitude, name, speed, status = 'active', onClick }: Props) {
  const dot = statusColor[status] ?? 'bg-slate-400';
  const ring = ringColor[status] ?? 'ring-slate-400/50';

  return (
    <Marker latitude={latitude} longitude={longitude} anchor="bottom">
      <button onClick={onClick} className="group -translate-y-1.5 flex flex-col items-center" title={name ?? 'Device'}>
        <div className={clsx('relative rounded-full p-2 shadow-md ring-2', ring, 'bg-white/10 backdrop-blur')}>
          <div className={clsx('rounded-full p-2', dot, 'shadow-inner shadow-black/20')}>
            <Car className="h-4 w-4 text-white drop-shadow" />
          </div>
          {status === 'active' && <span className="marker-pulse absolute inset-0 rounded-full"></span>}
        </div>
        <div className="mt-1 rounded bg-white/90 dark:bg-slate-900/80 text-[10px] px-1.5 py-0.5 shadow border border-slate-200/70 dark:border-slate-800/70">
          {name ?? 'Device'}{typeof speed === 'number' ? ` • ${Math.round(speed)} km/h` : ''}
        </div>
      </button>
    </Marker>
  );
}
