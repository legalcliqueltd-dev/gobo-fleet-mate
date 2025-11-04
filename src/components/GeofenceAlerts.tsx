import { useState, useEffect, useRef } from 'react';
import { useGeofenceEvents } from '../hooks/useGeofenceEvents';
import { Bell, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function GeofenceAlerts() {
  const { events, unacknowledgedCount, acknowledgeEvent } = useGeofenceEvents(5);
  const [isOpen, setIsOpen] = useState(false);
  const prevCountRef = useRef(unacknowledgedCount);

  const unacknowledgedEvents = events.filter((e) => !e.acknowledged);

  // Show toast notification for new geofence events
  useEffect(() => {
    if (unacknowledgedCount > prevCountRef.current && unacknowledgedEvents.length > 0) {
      const latestEvent = unacknowledgedEvents[0];
      toast.warning(
        `${latestEvent.device_name} ${latestEvent.event_type === 'enter' ? 'entered' : 'exited'} ${latestEvent.geofence_name}`,
        {
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => setIsOpen(true),
          },
        }
      );
    }
    prevCountRef.current = unacknowledgedCount;
  }, [unacknowledgedCount, unacknowledgedEvents]);

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeEvent(id);
      toast.success('Event acknowledged');
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (unacknowledgedCount === 0) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-cyan-600 text-white p-4 shadow-lg hover:bg-cyan-700 transition-colors"
        title="Geofence alerts"
      >
        <Bell className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
          {unacknowledgedCount}
        </span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col animate-slide-up">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-cyan-600" />
                <h3 className="font-semibold">Geofence Alerts</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              {unacknowledgedEvents.length === 0 ? (
                <div className="text-center text-slate-500 py-8">No unacknowledged alerts</div>
              ) : (
                <div className="space-y-3">
                  {unacknowledgedEvents.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-lg border border-amber-300 bg-amber-50/50 dark:bg-amber-900/10 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {event.device_name}{' '}
                            <span className={event.event_type === 'enter' ? 'text-emerald-600' : 'text-red-600'}>
                              {event.event_type === 'enter' ? 'entered' : 'exited'}
                            </span>{' '}
                            {event.geofence_name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {new Date(event.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <button
                          onClick={() => handleAcknowledge(event.id)}
                          className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-900/20 rounded-full transition-colors"
                          title="Acknowledge"
                        >
                          <Check className="h-4 w-4 text-emerald-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
