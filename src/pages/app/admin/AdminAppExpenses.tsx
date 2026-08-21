import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Wallet, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminCodes } from '@/hooks/useAdminCodes';
import { Button } from '@/components/ui/button';
import {
  categoryMeta,
  fetchFleetExpenses,
  formatMoney,
  reviewExpense,
  STATUS_STYLE,
  summariseExpenses,
  type Expense,
  type ExpenseStatus,
} from '@/integrations/supabase/expenses';
import { cn } from '@/lib/utils';

const FILTERS: { id: ExpenseStatus | 'all'; label: string }[] = [
  { id: 'submitted', label: 'Waiting' },
  { id: 'approved', label: 'Approved' },
  { id: 'all', label: 'All' },
];

/**
 * Expense review for the manager.
 *
 * Defaults to what needs a decision rather than to everything, because the
 * only reason to open this screen is to clear the queue. Approve and reject
 * are single taps on the row — anything slower and receipts pile up, which is
 * exactly the failure that pushes drivers back to paper.
 */
export default function AdminAppExpenses() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { codes, loading: codesLoading } = useAdminCodes();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [driverNames, setDriverNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ExpenseStatus | 'all'>('submitted');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Expense | null>(null);

  const load = useCallback(async () => {
    if (codes.length === 0) {
      setExpenses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const rows = await fetchFleetExpenses(codes);
      setExpenses(rows);

      const ids = [...new Set(rows.map((e) => e.driver_id))];
      if (ids.length) {
        const { data } = await supabase
          .from('drivers')
          .select('driver_id, driver_name')
          .in('driver_id', ids);
        setDriverNames(
          Object.fromEntries((data ?? []).map((d) => [d.driver_id, d.driver_name ?? 'Driver']))
        );
      }
    } catch (err) {
      console.error('[AdminAppExpenses] load failed:', err);
      toast.error('Could not load expenses. Has the migration been run?');
    } finally {
      setLoading(false);
    }
  }, [codes]);

  useEffect(() => {
    if (!codesLoading) void load();
  }, [codesLoading, load]);

  const visible = useMemo(
    () => (filter === 'all' ? expenses : expenses.filter((e) => e.status === filter)),
    [expenses, filter]
  );

  // This month across the fleet — the number worth carrying at the top.
  const monthly = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return summariseExpenses(expenses.filter((e) => new Date(e.spent_at) >= start));
  }, [expenses]);

  const decide = async (expense: Expense, status: 'approved' | 'rejected') => {
    if (!user) return;
    setBusyId(expense.id);
    try {
      await reviewExpense(expense.id, status, user.id);
      toast.success(status === 'approved' ? 'Approved' : 'Rejected');
      void load();
    } catch (err) {
      console.error('[AdminAppExpenses] review failed:', err);
      toast.error('Could not save that decision');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={() => navigate('/app/admin/insights')}
          className="mb-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Insights
        </button>

        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Fleet spend this month
        </p>
        <p className="telemetry mt-1 text-2xl font-bold leading-none">
          {formatMoney(monthly.total)}
        </p>
        {monthly.pending > 0 && (
          <p className="mt-1.5 text-xs text-warning">
            {formatMoney(monthly.pending)} waiting on you
          </p>
        )}

        <div className="mt-4 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'min-h-[38px] flex-1 rounded-lg text-xs font-semibold transition-colors',
                filter === f.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}

        {!loading && visible.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Wallet className="h-6 w-6 text-muted-foreground" />
            </span>
            <p className="font-heading text-base font-semibold">
              {filter === 'submitted' ? 'Nothing waiting' : 'No expenses yet'}
            </p>
            <p className="max-w-[17rem] text-sm text-muted-foreground">
              Drivers log fuel, repairs and tolls from their app. They appear here for approval.
            </p>
          </div>
        )}

        <ul className="space-y-2.5">
          {visible.map((expense) => {
            const meta = categoryMeta(expense.category);
            const status = STATUS_STYLE[expense.status];
            return (
              <li
                key={expense.id}
                className="rounded-2xl border border-border bg-card p-4"
                style={{ boxShadow: 'var(--shadow-card)' }}
              >
                <div className="flex items-center gap-3">
                  {expense.photo_url ? (
                    <button type="button" onClick={() => setPreview(expense)} className="shrink-0">
                      <img
                        src={expense.photo_url}
                        alt="Receipt"
                        className="h-12 w-12 rounded-lg object-cover"
                        loading="lazy"
                      />
                    </button>
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                      {meta.emoji}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {driverNames[expense.driver_id] ?? expense.driver_id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {meta.label} · {format(new Date(expense.spent_at), 'd MMM')}
                      {!expense.photo_url && ' · no receipt'}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="telemetry text-base font-bold">
                      {formatMoney(Number(expense.amount), expense.currency)}
                    </p>
                    <span
                      className={cn(
                        'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold',
                        status.chip
                      )}
                    >
                      {status.label}
                    </span>
                  </div>
                </div>

                {expense.note && (
                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                    {expense.note}
                  </p>
                )}

                {expense.status === 'submitted' && (
                  <div className="mt-3.5 flex gap-2">
                    <Button
                      variant="outline"
                      className="h-10 flex-1 gap-1.5 text-xs text-destructive"
                      disabled={busyId === expense.id}
                      onClick={() => decide(expense, 'rejected')}
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                    <Button
                      className="h-10 flex-1 gap-1.5 text-xs"
                      disabled={busyId === expense.id}
                      onClick={() => decide(expense, 'approved')}
                    >
                      {busyId === expense.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Approve
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {preview?.photo_url && (
        <button
          type="button"
          onClick={() => setPreview(null)}
          className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black/90 p-4"
        >
          <img src={preview.photo_url} alt="Receipt" className="max-h-[75vh] w-auto rounded-lg" />
          <p className="telemetry mt-3 text-sm text-white/80">
            {formatMoney(Number(preview.amount), preview.currency)} ·{' '}
            {format(new Date(preview.spent_at), 'd MMM yyyy')}
          </p>
        </button>
      )}
    </div>
  );
}
