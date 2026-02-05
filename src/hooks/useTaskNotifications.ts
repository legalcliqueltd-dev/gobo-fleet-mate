import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook for real-time task notifications for mobile drivers.
 * Subscribes to task table changes filtered by driver_id and plays audio on new assignments.
 */
export function useTaskNotifications(driverId: string | undefined) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const seenTasksRef = useRef<Set<string>>(new Set());

  // Play notification sound using Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      // Double beep notification
      const playBeep = (startTime: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 880; // A5 note
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.15);
        oscillator.start(startTime);
        oscillator.stop(startTime + 0.15);
      };

      const now = ctx.currentTime;
      playBeep(now);
      playBeep(now + 0.2);
    } catch (error) {
      console.warn('Could not play notification sound:', error);
    }
  }, []);

  // Load initial unread count
  const loadUnreadCount = useCallback(async () => {
    if (!driverId) return;

    const { count, data } = await supabase
      .from('tasks')
      .select('id', { count: 'exact' })
      .eq('assigned_driver_id', driverId)
      .eq('status', 'assigned');

    if (count !== null) {
      setUnreadCount(count);
    }
    
    // Track seen tasks
    if (data) {
      data.forEach(t => seenTasksRef.current.add(t.id));
    }
  }, [driverId]);

  useEffect(() => {
    if (!driverId) return;

    loadUnreadCount();

    // Subscribe to real-time task changes
    const channel = supabase
      .channel(`driver-task-notifications-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_driver_id=eq.${driverId}`,
        },
        (payload) => {
          const newTask = payload.new as { id: string; title: string; status: string };
          
          // Only notify for new assigned tasks
          if (newTask.status === 'assigned' && !seenTasksRef.current.has(newTask.id)) {
            seenTasksRef.current.add(newTask.id);
            setNewTaskIds(prev => new Set(prev).add(newTask.id));
            setUnreadCount(prev => prev + 1);
            
            // Play sound and show toast
            playNotificationSound();
            toast.info(`New Task: ${newTask.title}`, {
              description: 'Tap to view details',
              duration: 5000,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tasks',
          filter: `assigned_driver_id=eq.${driverId}`,
        },
        (payload) => {
          const updatedTask = payload.new as { id: string; status: string };
          
          // If task was completed/delivered, decrease unread count
          if (['completed', 'delivered', 'cancelled'].includes(updatedTask.status)) {
            setUnreadCount(prev => Math.max(0, prev - 1));
            setNewTaskIds(prev => {
              const next = new Set(prev);
              next.delete(updatedTask.id);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, loadUnreadCount, playNotificationSound]);

  // Mark tasks as read
  const markAsRead = useCallback(() => {
    setNewTaskIds(new Set());
  }, []);

  return {
    unreadCount,
    newTaskIds,
    markAsRead,
    refresh: loadUnreadCount,
  };
}
