import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/**
 * Hook that subscribes to task completions and alerts the admin
 * with audio and toast notifications
 */
export function useAdminTaskNotifications() {
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const adminCodesRef = useRef<string[]>([]);

  // Initialize audio
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleStIj9LKmn0qIW6/1b2WZylJeLPIr4FLNll+pLmfbUZXcZKplm5JU2yEkpNrUlxng4uKaVBXYXp/f2pYXGJzfnxsX2Zjb3h5bWZqanN3d25qb3Bzdnh0cnV1dnh5d3h6eXp8fHt8fX5+fn9/f39/gIB/gICAf4CAgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYGBgYE=';
    
    return () => {
      audioRef.current = null;
    };
  }, []);

  // Load admin's connection codes
  useEffect(() => {
    const loadAdminCodes = async () => {
      if (!user) return;

      const { data: devices } = await supabase
        .from('devices')
        .select('connection_code')
        .eq('user_id', user.id)
        .not('connection_code', 'is', null);

      adminCodesRef.current = devices?.map(d => d.connection_code).filter(Boolean) as string[] || [];
    };

    loadAdminCodes();
  }, [user]);

  // Subscribe to task updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('admin-task-completion-alerts')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'tasks',
      }, async (payload) => {
        const newTask = payload.new as { 
          id: string; 
          title: string; 
          status: string; 
          created_by: string; 
          admin_code: string | null;
          assigned_driver_id: string | null;
        };
        const oldTask = payload.old as { status: string };

        // Only alert if status changed to 'completed' from something else
        if (oldTask.status === 'completed' || newTask.status !== 'completed') {
          return;
        }

        // Check if this task belongs to the current admin
        const isMyTask = newTask.created_by === user.id || 
                         (newTask.admin_code && adminCodesRef.current.includes(newTask.admin_code));

        if (!isMyTask) return;

        // Get driver name for the toast
        let driverName = 'Driver';
        if (newTask.assigned_driver_id) {
          const { data: driver } = await supabase
            .from('drivers')
            .select('driver_name')
            .eq('driver_id', newTask.assigned_driver_id)
            .single();
          
          if (driver?.driver_name) {
            driverName = driver.driver_name;
          }
        }

        // Play notification sound
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }

        // Show toast
        toast.success(`Task Completed: ${newTask.title}`, {
          description: `Completed by ${driverName}`,
          duration: 5000,
          action: {
            label: 'View',
            onClick: () => {
              // Scroll to completed section or navigate
              window.location.href = '/admin/tasks';
            },
          },
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}
