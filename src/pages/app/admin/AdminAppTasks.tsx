import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Loader2, MapPin, Package, Plus, Trash2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { Button } from '@/components/ui/button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { getDriverAccent } from '@/lib/driverAccent';
import { cn } from '@/lib/utils';

type Task = {
  id: string;
  title: string;
  description: string | null;
  assigned_driver_id: string | null;
  status: string;
  due_at: string | null;
  created_at: string;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
};

type Bucket = 'waiting' | 'active' | 'finished';

const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'waiting', label: 'Waiting' },
  { id: 'active', label: 'On the road' },
  { id: 'finished', label: 'Finished' },
];


/** Where a job sits on the Assigned -> On the road -> Delivered path. */
const PROGRESS_STEPS = ['Assigned', 'On the road', 'Delivered'] as const;

function progressIndex(status: string): number {
  if (status === 'completed') return 2;
  if (status === 'in_progress' || status === 'accepted' || status === 'started') return 1;
  return 0;
}

/** The DB carries several fine-grained statuses; managers think in three. */
function bucketOf(status: string): Bucket {
  if (status === 'completed' || status === 'failed' || status === 'cancelled') return 'finished';
  if (status === 'in_progress' || status === 'accepted' || status === 'started') return 'active';
  return 'waiting';
}

export default function AdminAppTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { codes, loading: codesLoading } = useAdminCodes();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [bucket, setBucket] = useState<Bucket>('waiting');
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });
      query = codes.length
        ? query.or(`created_by.eq.${user.id},admin_code.in.(${codes.join(',')})`)
        : query.eq('created_by', user.id);

      const { data, error } = await query;
      if (error) throw error;
      setTasks((data ?? []) as Task[]);

      const driverIds = [...new Set((data ?? []).map((t) => t.assigned_driver_id).filter(Boolean))];
      if (driverIds.length) {
        const { data: drivers } = await supabase
          .from('drivers')
          .select('driver_id, driver_name')
          .in('driver_id', driverIds as string[]);
        setDriverNames(
          Object.fromEntries((drivers ?? []).map((d) => [d.driver_id, d.driver_name ?? 'Driver']))
        );
      }
    } catch (err) {
      console.error('[AdminAppTasks] failed to load jobs:', err);
      toast.error('Could not load jobs');
    } finally {
      setLoading(false);
    }
  }, [user, codes]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  const grouped = useMemo(() => {
    const result: Record<Bucket, Task[]> = { waiting: [], active: [], finished: [] };
    tasks.forEach((task) => result[bucketOf(task.status)].push(task));
    return result;
  }, [tasks]);

  const visible = grouped[bucket];

  // Only genuinely completed jobs are clearable — failed and cancelled ones
  // are kept because they are the ones a manager still needs to look into.
  const clearableIds = useMemo(
    () => grouped.finished.filter((t) => t.status === 'completed').map((t) => t.id),
    [grouped.finished]
  );

  const clearFinished = async () => {
    if (!clearableIds.length) return;
    setClearing(true);
    try {
      const { error: reportsError } = await supabase
        .from('task_reports')
        .delete()
        .in('task_id', clearableIds);
      if (reportsError) throw reportsError;

      const { error } = await supabase.from('tasks').delete().in('id', clearableIds);
      if (error) throw error;

      toast.success(`Cleared ${clearableIds.length} finished job${clearableIds.length === 1 ? '' : 's'}`);
      setClearOpen(false);
      void load();
    } catch (err) {
      console.error('[AdminAppTasks] clear failed:', err);
      toast.error('Could not clear finished jobs');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Bucket filter */}
      <div className="flex gap-1.5 border-b border-border px-3 py-2.5">
        {BUCKETS.map((b) => {
          const isActive = bucket === b.id;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setBucket(b.id)}
              className={cn(
                'flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              {b.label}
              <span
                className={cn(
                  'telemetry rounded-full px-1.5 text-[10px]',
                  isActive ? 'bg-primary-foreground/20' : 'bg-background/70'
                )}
              >
                {grouped[b.id].length}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading jobs…
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Package className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="font-heading text-base font-semibold text-foreground">
              Nothing {bucket === 'finished' ? 'finished' : bucket === 'active' ? 'on the road' : 'waiting'}
            </p>
            <p className="max-w-[16rem] text-sm text-muted-foreground">
              {bucket === 'waiting'
                ? 'Create jobs on the website and they will appear here as soon as they are assigned.'
                : 'Jobs will show up here as your drivers work through them.'}
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {visible.map((task) => {
            const driver = task.assigned_driver_id ? driverNames[task.assigned_driver_id] : null;
            return (
              <li
                key={task.id}
                className="rounded-xl border border-border bg-card p-3.5"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 flex-1 font-heading text-base font-semibold leading-snug text-foreground">
                    {task.title}
                  </h3>
                  {task.status === 'failed' && (
                    <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                      Failed
                    </span>
                  )}
                </div>

                {task.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{task.description}</p>
                )}

                {/* Who has it — named, colour-keyed to the map marker, and
                    tappable straight through to that driver. */}
                <button
                  type="button"
                  disabled={!task.assigned_driver_id}
                  onClick={() =>
                    task.assigned_driver_id &&
                    navigate(`/app/admin/drivers/${task.assigned_driver_id}`)
                  }
                  className={cn(
                    'mt-2 inline-flex max-w-full items-center gap-2 rounded-full py-1 pl-1 pr-2.5 text-xs font-medium',
                    task.assigned_driver_id
                      ? 'bg-muted text-foreground'
                      : 'bg-warning/10 text-warning'
                  )}
                >
                  {task.assigned_driver_id ? (
                    <>
                      <span
                        className="h-5 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: getDriverAccent(task.assigned_driver_id) }}
                      />
                      <span className="truncate">{driver ?? 'Loading…'}</span>
                    </>
                  ) : (
                    <>
                      <User className="ml-1 h-3.5 w-3.5" />
                      Unassigned
                    </>
                  )}
                </button>

                {/* Progress */}
                <div className="mt-2.5">
                  <div className="flex gap-1">
                    {PROGRESS_STEPS.map((step, index) => {
                      const reached = index <= progressIndex(task.status);
                      const failed = task.status === 'failed';
                      return (
                        <div
                          key={step}
                          className={cn(
                            'h-1.5 flex-1 rounded-full',
                            failed && index === progressIndex(task.status)
                              ? 'bg-destructive'
                              : reached
                                ? 'bg-primary'
                                : 'bg-muted'
                          )}
                        />
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                    {task.status === 'failed'
                      ? 'Failed'
                      : PROGRESS_STEPS[progressIndex(task.status)]}
                  </p>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {task.due_at && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}
                    </span>
                  )}
                  {task.dropoff_lat != null && task.dropoff_lng != null && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Drop-off set
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div
        className="flex gap-2 border-t border-border bg-background px-3 py-2.5"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {bucket === 'finished' && clearableIds.length > 0 && (
          <Button variant="outline" className="h-11 flex-1 gap-2" onClick={() => setClearOpen(true)}>
            <Trash2 className="h-4 w-4" />
            Clear {clearableIds.length}
          </Button>
        )}
        <Button className="h-11 flex-1 gap-2" onClick={() => navigate('/app/admin/jobs/new')}>
          <Plus className="h-4 w-4" />
          Assign job
        </Button>
      </div>

      <ConfirmDialog
        open={clearOpen}
        onOpenChange={setClearOpen}
        title="Clear completed jobs?"
        description={`This permanently deletes ${clearableIds.length} completed job${clearableIds.length === 1 ? '' : 's'} and their delivery reports. Failed jobs are kept. This cannot be undone.`}
        confirmLabel={clearing ? 'Clearing…' : 'Clear jobs'}
        destructive
        onConfirm={clearFinished}
      />
    </div>
  );
}
