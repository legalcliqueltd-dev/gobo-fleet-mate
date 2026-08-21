import { supabase } from '@/integrations/supabase/client';

/**
 * Typed access to driver_expenses.
 *
 * Same containment as the stations module: `types.ts` is generated and does
 * not know this table yet, so the cast lives here alone and every caller gets
 * real types. Regenerate types after the migration and this can collapse to
 * plain `supabase.from(...)`.
 */
const db = supabase as unknown as { from: (table: string) => any };

export type ExpenseCategory = 'fuel' | 'repair' | 'tyres' | 'toll' | 'parking' | 'fine' | 'other';
export type ExpenseStatus = 'submitted' | 'approved' | 'rejected';

export type Expense = {
  id: string;
  driver_id: string;
  admin_code: string;
  category: ExpenseCategory;
  amount: number;
  currency: string;
  note: string | null;
  photo_url: string | null;
  spent_at: string;
  latitude: number | null;
  longitude: number | null;
  status: ExpenseStatus;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

export const EXPENSE_CATEGORIES: {
  id: ExpenseCategory;
  label: string;
  emoji: string;
}[] = [
  { id: 'fuel', label: 'Fuel', emoji: '⛽' },
  { id: 'repair', label: 'Repair', emoji: '🔧' },
  { id: 'tyres', label: 'Tyres', emoji: '🛞' },
  { id: 'toll', label: 'Toll', emoji: '🛣️' },
  { id: 'parking', label: 'Parking', emoji: '🅿️' },
  { id: 'fine', label: 'Fine', emoji: '🚨' },
  { id: 'other', label: 'Other', emoji: '📄' },
];

export function categoryMeta(id: ExpenseCategory) {
  return EXPENSE_CATEGORIES.find((c) => c.id === id) ?? EXPENSE_CATEGORIES[6];
}

export const STATUS_STYLE: Record<ExpenseStatus, { label: string; chip: string }> = {
  submitted: { label: 'Waiting', chip: 'bg-warning/10 text-warning' },
  approved: { label: 'Approved', chip: 'bg-success/10 text-success' },
  rejected: { label: 'Rejected', chip: 'bg-destructive/10 text-destructive' },
};

/** Money as the driver reads it: ₦12,500 — no decimals on whole amounts. */
export function formatMoney(amount: number, currency = 'NGN'): string {
  const symbol = currency === 'NGN' ? '₦' : '';
  const rounded = Number.isInteger(amount) ? amount : Number(amount.toFixed(2));
  return `${symbol}${rounded.toLocaleString()}`;
}

export async function fetchDriverExpenses(driverId: string, limit = 100): Promise<Expense[]> {
  const { data, error } = await db
    .from('driver_expenses')
    .select('*')
    .eq('driver_id', driverId)
    .order('spent_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function fetchFleetExpenses(adminCodes: string[], limit = 200): Promise<Expense[]> {
  if (adminCodes.length === 0) return [];
  const { data, error } = await db
    .from('driver_expenses')
    .select('*')
    .in('admin_code', adminCodes)
    .order('spent_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Expense[];
}

export async function createExpense(input: {
  driver_id: string;
  admin_code: string;
  category: ExpenseCategory;
  amount: number;
  note: string | null;
  photo_url: string | null;
  spent_at: string;
  latitude: number | null;
  longitude: number | null;
}): Promise<void> {
  const { error } = await db.from('driver_expenses').insert(input);
  if (error) throw error;
}

export async function reviewExpense(
  id: string,
  status: Exclude<ExpenseStatus, 'submitted'>,
  reviewerId: string,
  note?: string
): Promise<void> {
  const { error } = await db
    .from('driver_expenses')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq('id', id);
  if (error) throw error;
}

/** Totals for a period, split the way both sides care about. */
export function summariseExpenses(expenses: Expense[]) {
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const approved = expenses
    .filter((e) => e.status === 'approved')
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const pending = expenses
    .filter((e) => e.status === 'submitted')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const byCategory = new Map<ExpenseCategory, number>();
  expenses.forEach((e) => {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount));
  });

  return { total, approved, pending, count: expenses.length, byCategory };
}
