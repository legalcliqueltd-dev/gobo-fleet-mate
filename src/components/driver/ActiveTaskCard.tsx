import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Navigation, MapPin, Clock, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type Task = {
  id: string;
  title: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
  due_at?: string | null;
};

interface ActiveTaskCardProps {
  task: Task;
  driverLocation: { lat: number; lng: number } | null;
  onNavigate: () => void;
  /** Collapsed = slim pill so the map stays visible; driver toggles freely. */
  collapsed: boolean;
  onToggleCollapse: () => void;
}

function calculateDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function ActiveTaskCard({ task, driverLocation, onNavigate, collapsed, onToggleCollapse }: ActiveTaskCardProps) {
  const navigate = useNavigate();

  const distance = (driverLocation && task.dropoff_lat && task.dropoff_lng)
    ? calculateDistance(driverLocation.lat, driverLocation.lng, task.dropoff_lat, task.dropoff_lng)
    : null;

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const isArrived = distance !== null && distance < 0.05; // 50m

  // Collapsed: one slim pill — tap anywhere to expand, map stays in view.
  if (collapsed) {
    return (
      <div className="absolute bottom-0 left-0 right-0 z-30 p-3 pointer-events-auto">
        <button
          onClick={onToggleCollapse}
          className={cn(
            'flex min-h-[48px] w-full items-center gap-2.5 rounded-full border bg-card/95 px-4 py-2 shadow-xl backdrop-blur-lg',
            isArrived ? 'border-success' : 'border-border'
          )}
          aria-label="Expand task details"
        >
          <span className={cn(
            'h-2.5 w-2.5 shrink-0 rounded-full',
            isArrived ? 'bg-success' : task.status === 'en_route' ? 'bg-warning animate-pulse' : 'bg-primary'
          )} />
          <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{task.title}</span>
          {isArrived ? (
            <span className="shrink-0 font-mono text-[10px] font-bold uppercase tracking-wider text-success">Arrived</span>
          ) : (
            distance !== null && (
              <span className="telemetry shrink-0 text-xs text-muted-foreground">{formatDistance(distance)}</span>
            )
          )}
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>
    );
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 p-3 pointer-events-auto">
      <div className={cn(
        "bg-card/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-border overflow-hidden",
        isArrived && "border-success"
      )}>
        {/* Arrival banner */}
        {isArrived && (
          <div className="flex items-center justify-center gap-1.5 bg-success px-4 py-2 text-center text-sm font-semibold text-success-foreground">
            <MapPin className="h-4 w-4" />
            You've arrived at the drop-off
          </div>
        )}

        <div className="p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                <span className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  task.status === 'en_route' ? 'bg-warning animate-pulse' : 'bg-primary'
                )} />
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  {task.status === 'en_route' ? 'En route' : 'Assigned'}
                </span>
              </div>
              <h3 className="truncate font-heading text-base font-bold">{task.title}</h3>
              <div className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
                {distance !== null && (
                  <span className="telemetry flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {formatDistance(distance)}
                  </span>
                )}
                {task.due_at && (
                  <span className="telemetry flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center">
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11"
                onClick={onToggleCollapse}
                aria-label="Minimize task card"
              >
                <ChevronDown className="h-5 w-5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-11 w-11"
                onClick={() => navigate(`/app/tasks/${task.id}/complete`)}
                aria-label="Open task details"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            {task.dropoff_lat && task.dropoff_lng && (
              <Button
                className="h-12 flex-1 gap-2"
                onClick={onNavigate}
              >
                <Navigation className="h-4 w-4" />
                Navigate
              </Button>
            )}
            <Button
              variant={isArrived ? "default" : "secondary"}
              className={cn("h-12 flex-1", isArrived && "bg-success hover:bg-success/90 text-success-foreground")}
              onClick={() => navigate(`/app/tasks/${task.id}/complete`)}
            >
              {isArrived ? 'Complete task' : 'Details'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
