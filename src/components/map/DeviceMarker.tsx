import { OverlayView, OverlayViewF } from '@react-google-maps/api';
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
  const dot = statusColor[status ?? 'active'] ?? 'bg-slate-400';
  const ring = ringColor[status ?? 'active'] ?? 'ring-slate-400/50';

  return (
    <OverlayViewF
      position={{ lat: latitude, lng: longitude }}
      mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
      getPixelPositionOffset={() => ({ x: -16, y: -16 })}
    >
      <button onClick={onClick} className="group flex flex-col items-center" title={name ?? 'Device'} style={{ cursor: 'pointer' }}>
        <div className={clsx('relative rounded-full p-1 shadow-sm ring-1', ring, 'bg-white/10 backdrop-blur')}>
          <div className={clsx('rounded-full p-1', dot, 'shadow-inner shadow-black/20')}>
            <Car className="h-3 w-3 text-white drop-shadow" />
          </div>
          {status === 'active' && <span className="marker-pulse absolute inset-0 rounded-full"></span>}
        </div>
      </button>
    </OverlayViewF>
  );
}
