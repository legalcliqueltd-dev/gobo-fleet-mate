import { useState, useEffect, useRef } from 'react';
import { Bell, AlertTriangle, Clock, CheckCircle, Volume2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useSOSNotifications, SOSEventWithDriver } from '@/hooks/useSOSNotifications';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

function SOSEventItem({ event, onRead }: { event: SOSEventWithDriver; onRead: () => void }) {
  const statusColors = {
    open: 'bg-red-500',
    acknowledged: 'bg-yellow-500',
    resolved: 'bg-green-500',
    cancelled: 'bg-muted',
  };

  const statusIcons = {
    open: AlertTriangle,
    acknowledged: Clock,
    resolved: CheckCircle,
    cancelled: CheckCircle,
  };

  const StatusIcon = statusIcons[event.status as keyof typeof statusIcons] || AlertTriangle;

  return (
    <Link
      to="/ops/incidents"
      onClick={onRead}
      className="flex items-start gap-3 p-3 hover:bg-muted/50 rounded-lg transition-colors"
    >
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${statusColors[event.status as keyof typeof statusColors] || 'bg-muted'}`}>
        <StatusIcon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-medium text-sm truncate">{event.driver_name}</span>
          <Badge variant={event.status === 'open' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
            {event.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {event.hazard.charAt(0).toUpperCase() + event.hazard.slice(1)}
          {event.message && ` — ${event.message.slice(0, 30)}${event.message.length > 30 ? '...' : ''}`}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
        </p>
      </div>
      {event.photo_url && (
        <img
          src={event.photo_url}
          alt="Evidence"
          className="w-10 h-10 rounded object-cover"
        />
      )}
    </Link>
  );
}

export default function SOSNotificationBell() {
  const { openSOSCount, recentSOS, isAdmin, markAsRead, unreadIds } = useSOSNotifications();
  const [open, setOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousCountRef = useRef(openSOSCount);

  // Only show for admins
  if (!isAdmin) return null;

  const activeEvents = recentSOS.filter(e => e.status !== 'resolved' && e.status !== 'cancelled');
  const hasUnread = unreadIds.size > 0 || openSOSCount > 0;

  // Play alert sound and show toast when new SOS arrives
  useEffect(() => {
    if (openSOSCount > previousCountRef.current && openSOSCount > 0) {
      // New SOS arrived
      toast.error('🚨 New SOS Alert!', {
        description: 'A driver has triggered an emergency alert.',
        duration: 10000,
        action: {
          label: 'View',
          onClick: () => window.location.href = '/ops/incidents',
        },
      });

      // Play alert sound
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
      }
    }
    previousCountRef.current = openSOSCount;
  }, [openSOSCount]);

  return (
    <>
      {/* Hidden audio element for alert sound */}
      <audio
        ref={audioRef}
        preload="auto"
        src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleA8UU5Xb1oNGDgRMeaj/7IhGCgZMcrH/7ItKDAZKa7P/8I5SDQZFYrb/8pVZDQU/WLf/9Z5hDgQ3TLj/+qhrEQMuQLr/+7J1FAIjM7z//LuAGQEWI77//sWKHgEKFL/9/86UJQAEBL/9/taeLgIA+r39/d2oOAD/8rz9/eOyQgD/67r9/eixTQD/5Lb9/e2nWQD/3rH9/fKfZAD/2K39/fWXbwD/0qn9/fePegD/zKT8/fiHhQD/xp/8/fh/kAD/wJr8/fl2mwD/upT8/fltpgD/tI78/fllsQD/ronqAAAAAP/"
      />
      
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="SOS Notifications"
          >
            <Bell className={`h-5 w-5 ${hasUnread ? 'text-red-500' : ''}`} />
            {openSOSCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-white text-[10px] font-bold items-center justify-center">
                  {openSOSCount > 9 ? '9+' : openSOSCount}
                </span>
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="end">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              SOS Alerts
            </h3>
            {openSOSCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {openSOSCount} Active
              </Badge>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {activeEvents.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-success" />
                <p>No active SOS alerts</p>
                <p className="text-xs mt-1">All clear - your drivers are safe</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activeEvents.slice(0, 5).map((event) => (
                  <SOSEventItem
                    key={event.id}
                    event={event}
                    onRead={() => {
                      markAsRead(event.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="p-2 border-t border-border">
            <Link to="/ops/incidents">
              <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setOpen(false)}>
                View All Incidents
              </Button>
            </Link>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
