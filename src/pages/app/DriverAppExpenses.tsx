import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Check, Loader2, Plus, Receipt, Wallet, X } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useDriverSession } from '@/contexts/DriverSessionContext';
import DriverAppLayout from '@/components/layout/DriverAppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { capturePhoto, dataUrlToFile, isNativePlatform } from '@/utils/nativeCamera';
import {
  createExpense,
  categoryMeta,
  EXPENSE_CATEGORIES,
  fetchDriverExpenses,
  formatMoney,
  STATUS_STYLE,
  summariseExpenses,
  type Expense,
  type ExpenseCategory,
} from '@/integrations/supabase/expenses';
import { cn } from '@/lib/utils';

/**
 * The driver's money log.
 *
 * This is the first screen in the app that exists for him rather than about
 * him: he spends his own cash on fuel, repairs and tolls, tracks it on paper
 * or not at all, and argues about it at month end. Here it takes three taps
 * and produces a record that gets him paid back.
 *
 * That exchange is also why tracking works at all — a driver who opens the app
 * for his own reasons keeps his phone charged, and every tracking feature
 * silently depends on that.
 *
 * The photo is optional on purpose: a toll booth rarely gives a receipt, and
 * refusing the expense over it would push him straight back to the notebook.
 */
export default function DriverAppExpenses() {
  const { session } = useDriverSession();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.driverId) return;
    setLoading(true);
    try {
      setExpenses(await fetchDriverExpenses(session.driverId));
    } catch (err) {
      console.warn('[DriverAppExpenses] load failed:', err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [session?.driverId]);

  useEffect(() => {
    void load();
  }, [load]);

  // This month, because that is the unit reimbursement is argued in.
  const thisMonth = useMemo(() => {
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return summariseExpenses(expenses.filter((e) => new Date(e.spent_at) >= start));
  }, [expenses]);

  return (
    <DriverAppLayout>
      <div className="flex h-full flex-col">
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <div className="mb-5">
            <p className="eyebrow mb-1">Your money</p>
            <h1 className="font-heading text-2xl font-bold">Expenses</h1>
          </div>

          {/* This month — the number he came to see */}
          <div
            className="mb-6 rounded-2xl border border-border bg-card p-5"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Spent this month
            </p>
            <p className="telemetry mt-1.5 text-3xl font-bold leading-none text-foreground">
              {formatMoney(thisMonth.total)}
            </p>

            <div className="mt-4 flex gap-4 border-t border-border pt-3.5">
              <div>
                <p className="telemetry text-sm font-bold text-success">
                  {formatMoney(thisMonth.approved)}
                </p>
                <p className="text-[11px] text-muted-foreground">Approved</p>
              </div>
              <div>
                <p className="telemetry text-sm font-bold text-warning">
                  {formatMoney(thisMonth.pending)}
                </p>
                <p className="text-[11px] text-muted-foreground">Waiting</p>
              </div>
              <div>
                <p className="telemetry text-sm font-bold text-foreground">{thisMonth.count}</p>
                <p className="text-[11px] text-muted-foreground">Entries</p>
              </div>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          )}

          {!loading && expenses.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Wallet className="h-6 w-6 text-muted-foreground" />
              </span>
              <p className="font-heading text-base font-semibold">Nothing logged yet</p>
              <p className="max-w-[17rem] text-sm text-muted-foreground">
                Log fuel, repairs and tolls as you pay for them. Your manager sees the total and
                you keep the proof.
              </p>
            </div>
          )}

          <ul className="space-y-2.5">
            {expenses.map((expense) => {
              const meta = categoryMeta(expense.category);
              const status = STATUS_STYLE[expense.status];
              return (
                <li
                  key={expense.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5"
                  style={{ boxShadow: 'var(--shadow-card)' }}
                >
                  {expense.photo_url ? (
                    <img
                      src={expense.photo_url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-xl">
                      {meta.emoji}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{meta.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(expense.spent_at), 'd MMM, HH:mm')}
                    </p>
                    {expense.review_note && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        “{expense.review_note}”
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="telemetry text-sm font-bold">
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
                </li>
              );
            })}
          </ul>
        </div>

        <div
          className="border-t border-border bg-background px-4 py-3"
          style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
        >
          <Button className="h-12 w-full gap-2 font-semibold" onClick={() => setComposing(true)}>
            <Plus className="h-4 w-4" />
            Log an expense
          </Button>
        </div>
      </div>

      {composing && session && (
        <ExpenseComposer
          driverId={session.driverId}
          adminCode={session.adminCode}
          onClose={() => setComposing(false)}
          onSaved={() => {
            setComposing(false);
            void load();
          }}
        />
      )}
    </DriverAppLayout>
  );
}

/** Full-screen capture sheet: category, amount, optional photo. */
function ExpenseComposer({
  driverId,
  adminCode,
  onClose,
  onSaved,
}: {
  driverId: string;
  adminCode: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [category, setCategory] = useState<ExpenseCategory>('fuel');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const attachPhoto = async () => {
    try {
      if (isNativePlatform()) {
        const shot = await capturePhoto('camera');
        if (!shot) return;
        setPhoto({
          file: dataUrlToFile(shot.dataUrl, `receipt-${Date.now()}.jpg`),
          preview: shot.dataUrl,
        });
        return;
      }
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = () => {
        const file = input.files?.[0];
        if (file) setPhoto({ file, preview: URL.createObjectURL(file) });
      };
      input.click();
    } catch (err) {
      console.error('[ExpenseComposer] photo failed:', err);
      toast.error('Could not open the camera');
    }
  };

  const save = async () => {
    const value = Number(amount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(value) || value <= 0) {
      toast.error('Enter how much you spent');
      return;
    }

    setSaving(true);
    try {
      let photoUrl: string | null = null;

      if (photo) {
        const path = `${adminCode}/${driverId}/${Date.now()}.jpg`;
        const { data, error } = await supabase.storage
          .from('expense-receipts')
          .upload(path, photo.file, { contentType: photo.file.type, upsert: false });
        if (error) throw error;
        photoUrl = supabase.storage.from('expense-receipts').getPublicUrl(data.path).data.publicUrl;
      }

      await createExpense({
        driver_id: driverId,
        admin_code: adminCode,
        category,
        amount: value,
        note: note.trim() || null,
        photo_url: photoUrl,
        spent_at: new Date().toISOString(),
        latitude: null,
        longitude: null,
      });

      toast.success('Expense logged');
      onSaved();
    } catch (err) {
      console.error('[ExpenseComposer] save failed:', err);
      toast.error('Could not save. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col bg-background">
      <header
        className="flex items-center gap-2 border-b border-border px-3 py-2.5"
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
      >
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Cancel"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="flex-1 font-heading text-lg font-semibold">Log an expense</h2>
      </header>

      <div className="flex-1 space-y-7 overflow-y-auto px-4 py-5">
        <div className="space-y-2">
          <Label>What was it for?</Label>
          <div className="grid grid-cols-4 gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={cn(
                  'flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-[10px] font-medium transition-colors',
                  category === c.id
                    ? 'border-primary bg-accent text-accent-foreground'
                    : 'border-border bg-card text-muted-foreground'
                )}
              >
                <span className="text-xl">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="amount">How much?</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
              ₦
            </span>
            <Input
              id="amount"
              // Numeric keypad, not the full keyboard — he is often standing
              // at a pump with one hand free.
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="telemetry h-16 pl-10 text-2xl font-bold"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Receipt photo (optional)</Label>
          {photo ? (
            <div className="relative overflow-hidden rounded-xl border border-border">
              <img src={photo.preview} alt="Receipt" className="h-44 w-full object-cover" />
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-background/90 backdrop-blur"
                aria-label="Remove photo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={attachPhoto}
              className="flex min-h-[76px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card text-sm font-medium text-muted-foreground"
            >
              <Camera className="h-5 w-5" />
              Take a photo of the receipt
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            Not every purchase gives a receipt — you can log it without one.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note">Note (optional)</Label>
          <Textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Full tank at Conoil, Ikorodu Road"
            rows={2}
          />
        </div>
      </div>

      <div
        className="border-t border-border px-4 py-3"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <Button className="h-12 w-full gap-2 font-semibold" disabled={saving} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save expense'}
        </Button>
      </div>
    </div>
  );
}
