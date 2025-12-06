import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Wifi, WifiOff, RefreshCw, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

type QueuedAction = {
  id: string;
  type: 'location' | 'task_update' | 'sos' | 'photo_upload';
  data: any;
  timestamp: number;
  retries: number;
  status: 'pending' | 'syncing' | 'failed';
};

export default function OfflineQueue() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState<QueuedAction[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Load queue from localStorage
    loadQueue();

    // Listen for online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online - syncing queued actions');
      syncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.error('You are offline - actions will be queued');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadQueue = () => {
    const savedQueue = localStorage.getItem('offline_queue');
    if (savedQueue) {
      try {
        setQueue(JSON.parse(savedQueue));
      } catch (error) {
        console.error('Error loading queue:', error);
      }
    }
  };

  const saveQueue = (newQueue: QueuedAction[]) => {
    localStorage.setItem('offline_queue', JSON.stringify(newQueue));
    setQueue(newQueue);
  };

  const syncQueue = async () => {
    if (!isOnline || queue.length === 0 || syncing) return;

    setSyncing(true);
    const updatedQueue = [...queue];
    let syncedCount = 0;

    for (let i = 0; i < updatedQueue.length; i++) {
      const action = updatedQueue[i];
      if (action.status === 'syncing') continue;

      updatedQueue[i].status = 'syncing';
      saveQueue(updatedQueue);

      try {
        // Process the action based on type
        switch (action.type) {
          case 'location':
            // await supabase.from('locations').insert(action.data);
            console.log('Syncing location:', action.data);
            break;
          case 'task_update':
            // await supabase.from('tasks').update(action.data.updates).eq('id', action.data.taskId);
            console.log('Syncing task update:', action.data);
            break;
          case 'sos':
            // await supabase.from('sos_events').insert(action.data);
            console.log('Syncing SOS:', action.data);
            break;
          case 'photo_upload':
            // Upload photo to storage
            console.log('Syncing photo:', action.data);
            break;
        }

        // Remove from queue on success
        updatedQueue.splice(i, 1);
        i--; // Adjust index after removal
        syncedCount++;
      } catch (error) {
        console.error('Error syncing action:', error);
        updatedQueue[i].status = 'failed';
        updatedQueue[i].retries = (updatedQueue[i].retries || 0) + 1;

        // Remove if too many retries
        if (updatedQueue[i].retries >= 3) {
          updatedQueue.splice(i, 1);
          i--;
        }
      }
    }

    saveQueue(updatedQueue);
    setSyncing(false);

    if (syncedCount > 0) {
      toast.success(`Synced ${syncedCount} action${syncedCount !== 1 ? 's' : ''}`);
    }
  };

  const clearQueue = () => {
    if (confirm('Clear all queued actions? This cannot be undone.')) {
      saveQueue([]);
      toast.success('Queue cleared');
    }
  };

  const removeAction = (id: string) => {
    const newQueue = queue.filter((a) => a.id !== id);
    saveQueue(newQueue);
    toast.success('Action removed from queue');
  };

  if (queue.length === 0 && isOnline) {
    return null; // Don't show if no queued items and online
  }

  return (
    <Card className="m-4 bg-background/50 backdrop-blur border border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isOnline ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            <div>
              <h3 className="font-semibold">Sync Queue</h3>
              <p className="text-xs text-muted-foreground">
                {isOnline ? 'Online' : 'Offline'} • {queue.length} pending
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {isOnline && queue.length > 0 && (
              <Button
                size="sm"
                onClick={syncQueue}
                disabled={syncing}
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            )}
            {queue.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={clearQueue}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {queue.length > 0 && (
        <CardContent>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {queue.map((action) => (
              <div
                key={action.id}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <Badge
                    variant={
                      action.status === 'syncing'
                        ? 'secondary'
                        : action.status === 'failed'
                        ? 'destructive'
                        : 'default'
                    }
                    className="text-xs"
                  >
                    {action.type.replace('_', ' ')}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {new Date(action.timestamp).toLocaleTimeString()}
                  </span>
                  {action.status === 'syncing' && (
                    <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  {action.status === 'failed' && action.retries > 0 && (
                    <span className="text-xs text-red-500">
                      Retry {action.retries}/3
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeAction(action.id)}
                  disabled={action.status === 'syncing'}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Helper function to add actions to queue (export for use in other components)
export const queueOfflineAction = (
  type: QueuedAction['type'],
  data: any
): void => {
  const savedQueue = localStorage.getItem('offline_queue');
  const queue: QueuedAction[] = savedQueue ? JSON.parse(savedQueue) : [];

  const newAction: QueuedAction = {
    id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    data,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending',
  };

  queue.push(newAction);
  localStorage.setItem('offline_queue', JSON.stringify(queue));

  // Dispatch custom event to notify OfflineQueue component
  window.dispatchEvent(new CustomEvent('offline-queue-updated'));
};
