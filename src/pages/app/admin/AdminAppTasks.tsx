import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Package, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { Button } from '@/components/ui/button';
import ScreenHeader from '@/components/ScreenHeader';
import ConfirmDialog from '@/components/ConfirmDialog';
import JobDetailSheet, { type JobForDetail } from '@/components/admin/JobDetailSheet';
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
  const [openJob, setOpenJob] = useState<JobForDetail | null>(null);

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

  const openCount = grouped.waiting.length + grouped.active.length;

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto pb-4">
        <ScreenHeader
          eyebrow="Your fleet"
          title="Jobs"
          count={loading ? null : openCount}
          countLabel="open"
          done={grouped.finished.length}
          total={tasks.length}
        >
          {/* The three buckets live in the slab: they are how you read it. */}
          <div className="flex gap-1.5">
            {BUCKETS.map((b) => {
              const isActive = bucket === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBucket(b.id)}
                  className={cn(
                    'flex min-h-[36px] flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-xs font-semibold transition-colors',
                    isActive
                      ? 'bg-signal text-signal-foreground'
                      : 'bg-brand-ink-foreground/10 text-brand-ink-foreground/75'
                  )}
                >
                  {b.label}
                  <span className="telemetry opacity-70">{grouped[b.id].length}</span>
                </button>
              );
            })}
          </div>
        </ScreenHeader>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading jobs…
          </div>
        )}

        {!loading && visible.length === 0 && (
          <p className="px-8 py-14 text-center text-sm text-muted-foreground">
            Nothing {bucket === 'finished' ? 'finished' : bucket === 'active' ? 'on the road' : 'waiting'}.
          </p>
        )}

        {/* Same row as the More sheet: tile, title, one line. The tile's dot
            is the job's state, so nothing else on the row needs a colour. */}
        <ul className="mt-3 px-3">
          {visible.map((task) => {
            const driver = task.assigned_driver_id ? driverNames[task.assigned_driver_id] : null;
            const accent = task.assigned_driver_id
              ? getDriverAccent(task.assigned_driver_id)
              : '#6b7280';
            const failed = task.status === 'failed';
            const state = bucketOf(task.status);
            const note = [
              failed ? 'Failed' : null,
              driver ?? 'Unassigned',
              task.due_at ? `due ${formatDistanceToNow(new Date(task.due_at), { addSuffix: true })}` : null,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <li key={task.id}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenJob({
                      id: task.id,
                      title: task.title,
                      description: task.description,
                      status: task.status,
                      created_at: task.created_at,
                      due_at: task.due_at,
                      dropoff_lat: task.dropoff_lat,
                      dropoff_lng: task.dropoff_lng,
                      driverName: driver,
                      accent,
                    })
                  }
                  className="flex min-h-[56px] w-full items-center gap-3.5 rounded-xl px-2.5 py-2 text-left transition-colors active:bg-muted"
                >
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent">
                    <Package className="h-[18px] w-[18px] text-accent-foreground" />
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-background',
                        failed
                          ? 'bg-sos'
                          : state === 'active'
                            ? 'bg-success'
                            : state === 'finished'
                              ? 'bg-muted-foreground'
                              : 'bg-warning'
                      )}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{task.title}</span>
                    <span className={cn('block truncate text-xs', failed ? 'text-sos' : 'text-muted-foreground')}>
                      {note}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Housekeeping sits at the end of the list it tidies, not in the
            footer competing with the one action that matters. */}
        {bucket === 'finished' && clearableIds.length > 0 && (
          <button
            type="button"
            onClick={() => setClearOpen(true)}
            className="mx-auto mt-2 flex min-h-[44px] items-center px-4 text-xs font-medium text-muted-foreground"
          >
            Clear {clearableIds.length} completed
          </button>
        )}
      </div>

      <div
        className="border-t border-border bg-background px-4 py-3"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <Button className="h-12 w-full gap-2" onClick={() => navigate('/app/admin/jobs/new')}>
          <Plus className="h-4 w-4" />
          Assign job
        </Button>
      </div>

      <JobDetailSheet job={openJob} onClose={() => setOpenJob(null)} />

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
