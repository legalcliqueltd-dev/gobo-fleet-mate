import { Marker } from '@react-google-maps/api';
import { Car } from 'lucide-react';
import clsx from 'clsx';
import { renderToStaticMarkup } from 'react-dom/server';

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

  // Smaller marker content
  const markerContent = (
    <button onClick={onClick} className="group -translate-y-1 flex flex-col items-center" title={name ?? 'Device'}>
      <div className={clsx('relative rounded-full p-1 shadow-sm ring-1', ring, 'bg-white/10 backdrop-blur')}>
        <div className={clsx('rounded-full p-1', dot, 'shadow-inner shadow-black/20')}>
          <Car className="h-3 w-3 text-white drop-shadow" />
        </div>
        {status === 'active' && <span className="marker-pulse absolute inset-0 rounded-full"></span>}
      </div>
    </button>
  );

  const iconHtml = renderToStaticMarkup(markerContent);

  return (
    <Marker
      position={{ lat: latitude, lng: longitude }}
      icon={{
        url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconHtml)}`,
        anchor: new google.maps.Point(12, 24),
        scaledSize: new google.maps.Size(24, 24),
      }}
      onClick={onClick}
    />
  );
}
