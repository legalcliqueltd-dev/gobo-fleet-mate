import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Navigation, MapPin, Clock, ChevronRight } from 'lucide-react';
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

export default function ActiveTaskCard({ task, driverLocation, onNavigate }: ActiveTaskCardProps) {
  const navigate = useNavigate();

  const distance = (driverLocation && task.dropoff_lat && task.dropoff_lng)
    ? calculateDistance(driverLocation.lat, driverLocation.lng, task.dropoff_lat, task.dropoff_lng)
    : null;

  const formatDistance = (km: number) => {
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const isArrived = distance !== null && distance < 0.05; // 50m

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 p-3 pointer-events-auto">
      <div className={cn(
        "bg-background rounded-2xl shadow-2xl border border-border overflow-hidden",
        isArrived && "border-success"
      )}>
        {/* Arrival banner */}
        {isArrived && (
          <div className="bg-success text-success-foreground px-4 py-2 text-center text-sm font-semibold">
            📍 You've arrived at the drop-off!
          </div>
        )}

        <div className="p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  task.status === 'en_route' ? 'bg-warning animate-pulse' : 'bg-primary'
                )} />
                <h3 className="font-bold text-base truncate">{task.title}</h3>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {distance !== null && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {formatDistance(distance)}
                  </span>
                )}
                {task.due_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(task.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0"
              onClick={() => navigate(`/app/tasks/${task.id}/complete`)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex gap-2">
            {task.dropoff_lat && task.dropoff_lng && (
              <Button
                className="flex-1 gap-2"
                onClick={onNavigate}
              >
                <Navigation className="h-4 w-4" />
                Navigate
              </Button>
            )}
            <Button
              variant={isArrived ? "default" : "secondary"}
              className={cn("flex-1", isArrived && "bg-success hover:bg-success/90 text-success-foreground")}
              onClick={() => navigate(`/app/tasks/${task.id}/complete`)}
            >
              {isArrived ? 'Complete Task' : 'Details'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
