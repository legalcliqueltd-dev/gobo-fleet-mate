import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook for real-time task notifications for mobile drivers.
 * Uses edge-function polling instead of direct Supabase queries (RLS blocks anon drivers).
 */
export function useTaskNotifications(driverId: string | undefined, adminCode?: string) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [newTaskIds, setNewTaskIds] = useState<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const knownTaskIdsRef = useRef<Set<string>>(new Set());
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Play notification sound using Web Audio API
  const playNotificationSound = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      
      const playBeep = (startTime: number) => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.frequency.value = 880;
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

  // Fetch tasks via edge function (bypasses RLS)
  const fetchTasks = useCallback(async () => {
    if (!driverId) return;

    const effectiveAdminCode = adminCode || localStorage.getItem('ftm_admin_code');
    if (!effectiveAdminCode) return;

    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'get-tasks',
          driverId,
          adminCode: effectiveAdminCode,
          statuses: ['assigned', 'en_route'],
        },
      });

      if (error || !data?.tasks) return;

      const tasks: { id: string; title: string; status: string }[] = data.tasks;
      const assignedTasks = tasks.filter(t => t.status === 'assigned');
      setUnreadCount(assignedTasks.length);

      // Detect new tasks
      const currentIds = new Set(tasks.map(t => t.id));
      
      for (const task of assignedTasks) {
        if (!knownTaskIdsRef.current.has(task.id)) {
          // New task detected
          setNewTaskIds(prev => new Set(prev).add(task.id));
          playNotificationSound();
          toast.info(`New Task: ${task.title}`, {
            description: 'Tap to view details',
            duration: 5000,
          });
        }
      }

      // Update known IDs
      knownTaskIdsRef.current = currentIds;
    } catch (err) {
      console.error('Task notification poll error:', err);
    }
  }, [driverId, adminCode, playNotificationSound]);

  useEffect(() => {
    if (!driverId) return;

    // Fetch immediately
    fetchTasks();

    // Poll every 15 seconds
    pollIntervalRef.current = setInterval(fetchTasks, 15000);

    // Pause polling when tab is hidden
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchTasks();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [driverId, fetchTasks]);

  const markAsRead = useCallback(() => {
    setNewTaskIds(new Set());
  }, []);

  return {
    unreadCount,
    newTaskIds,
    markAsRead,
    refresh: fetchTasks,
  };
}
