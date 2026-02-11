import { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Wifi, WifiOff, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const syncQueueRef = useRef<() => void>(() => {});

  useEffect(() => {
    loadQueue();

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online - syncing queued actions');
      syncQueueRef.current();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error('You are offline - actions will be queued');
    };
    const handleQueueUpdated = () => loadQueue();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('offline-queue-updated', handleQueueUpdated);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-queue-updated', handleQueueUpdated);
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

  const syncQueue = useCallback(async () => {
    if (!navigator.onLine || queue.length === 0 || syncing) return;

    setSyncing(true);
    const updatedQueue = [...queue];
    let syncedCount = 0;

    for (let i = 0; i < updatedQueue.length; i++) {
      const action = updatedQueue[i];
      if (action.status === 'syncing') continue;

      updatedQueue[i] = { ...updatedQueue[i], status: 'syncing' };
      saveQueue(updatedQueue);

      try {
        switch (action.type) {
          case 'location': {
            const { error } = await supabase.functions.invoke('connect-driver', {
              body: { action: 'update-location', ...action.data },
            });
            if (error) throw error;
            break;
          }
          case 'task_update': {
            const { error } = await supabase
              .from('tasks')
              .update(action.data.updates)
              .eq('id', action.data.taskId);
            if (error) throw error;
            break;
          }
          case 'sos': {
            const { error } = await supabase.functions.invoke('sos-create', {
              body: action.data,
            });
            if (error) throw error;
            break;
          }
          case 'photo_upload': {
            const { error } = await supabase.storage
              .from(action.data.bucket || 'proofs')
              .upload(action.data.path, action.data.file);
            if (error) throw error;
            break;
          }
        }

        updatedQueue.splice(i, 1);
        i--;
        syncedCount++;
      } catch (error) {
        console.error('Error syncing action:', error);
        updatedQueue[i] = {
          ...updatedQueue[i],
          status: 'failed',
          retries: (updatedQueue[i].retries || 0) + 1,
        };
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
  }, [queue, syncing]);

  const syncQueueRef = useRef(syncQueue);
  useEffect(() => { syncQueueRef.current = syncQueue; }, [syncQueue]);

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
