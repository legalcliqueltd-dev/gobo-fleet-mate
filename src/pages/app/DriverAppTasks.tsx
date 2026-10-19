import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import { supabase } from '@/integrations/supabase/client';
import { Check, CheckCircle2, Clock, Loader2, MapPin, Navigation, Package } from 'lucide-react';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import ScreenHeader from '@/components/ScreenHeader';
import TaskNavigationMap from '@/components/map/TaskNavigationMap';
import { cn } from '@/lib/utils';

type Task = {
  id: string;
  title: string;
  description: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: string;
  due_at: string | null;
};

/**
 * The work this driver was given. Sibling screen to Stations, and built from
 * the same parts on purpose: same navy slab, same card, same solid status
 * chip. To a driver a job and a station are the same object — somewhere he
 * has to be — so the two screens should not feel like two products.
 */
export default function DriverAppTasks() {
  const { session } = useDriverSession();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [navigatingTask, setNavigatingTask] = useState<Task | null>(null);

  const loadTasks = useCallback(async () => {
    if (!session?.driverId || !session?.adminCode) return;

    try {
      const { data, error } = await supabase.functions.invoke('connect-driver', {
        body: {
          action: 'get-tasks',
          driverId: session.driverId,
          adminCode: session.adminCode,
          statuses: ['assigned', 'en_route', 'completed'],
        },
      });

      if (error) throw error;
      if (data?.tasks) setTasks(data.tasks);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [session?.driverId, session?.adminCode]);

  useEffect(() => {
    loadTasks();
    // Poll every 15 seconds
    const interval = setInterval(loadTasks, 15000);
    const handleVisibility = () => { if (document.visibilityState === 'visible') loadTasks(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadTasks]);

  const formatDueDate = (date: string | null) => {
    if (!date) return null;
    const d = new Date(date);
    const isToday = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
  };

  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <DriverAppLayout>
      {navigatingTask && navigatingTask.dropoff_lat && navigatingTask.dropoff_lng && (
        <TaskNavigationMap
          dropoffLat={navigatingTask.dropoff_lat}
          dropoffLng={navigatingTask.dropoff_lng}
          taskTitle={navigatingTask.title}
          onClose={() => setNavigatingTask(null)}
        />
      )}

      <div className="pb-6">
        <ScreenHeader
          eyebrow="Assigned to you"
          title="Jobs"
          count={loading ? null : activeTasks.length}
          countLabel={activeTasks.length === 1 ? 'to do' : 'to do'}
          done={completedTasks.length}
          total={tasks.length}
        />

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="mt-12 flex flex-col items-center gap-3 px-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent">
              <Package className="h-7 w-7 text-accent-foreground" />
            </span>
            <p className="font-heading text-base font-bold">No jobs yet</p>
            <p className="max-w-[16rem] text-sm leading-relaxed text-muted-foreground">
              Work your manager assigns to you shows up here straight away.
            </p>
          </div>
        )}

        <ul className="mt-4 space-y-2.5 px-4">
          {activeTasks.map((task) => {
            const enRoute = task.status === 'en_route';
            const hasDropoff = task.dropoff_lat != null && task.dropoff_lng != null;
            return (
              <li
                key={task.id}
                className="relative overflow-hidden rounded-2xl border border-border bg-card"
              >
                {/* En route earns the neon spine. Assigned does not — if every
                    card is marked, none of them are. */}
                {enRoute && (
                  <span className="absolute inset-y-0 left-0 w-1 bg-signal" aria-hidden="true" />
                )}

                <div className="p-3.5 pl-[18px]">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.12em]',
                      enRoute
                        ? 'bg-success text-success-foreground'
                        : 'bg-secondary text-secondary-foreground'
                    )}
                  >
                    {enRoute && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success-foreground" />}
                    {enRoute ? 'On the way' : 'Assigned'}
                  </span>

                  <h2 className="mt-2 font-heading text-[17px] font-bold leading-tight tracking-tight">
                    {task.title}
                  </h2>

                  {task.description && (
                    <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {task.description}
                    </p>
                  )}

                  {(hasDropoff || task.due_at) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {hasDropoff && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Drop-off set
                        </span>
                      )}
                      {task.due_at && (
                        <span className="telemetry flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDueDate(task.due_at)}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-3.5 flex gap-2">
                    {hasDropoff && (
                      <button
                        type="button"
                        onClick={() => setNavigatingTask(task)}
                        className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold"
                      >
                        <Navigation className="h-4 w-4" />
                        Navigate
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => navigate(`/app/tasks/${task.id}/complete`)}
                      className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Complete
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {completedTasks.length > 0 && (
          <section className="mt-6 px-4">
            <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Done · {completedTasks.length}
            </h2>
            <ul className="mt-2 space-y-1.5">
              {completedTasks.slice(0, 5).map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success text-success-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                    {task.title}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </DriverAppLayout>
  );
}
