import { supabase } from '@/integrations/supabase/client';

/** Typed access to driver_reports; cast contained here as with the others. */
const db = supabase as unknown as { from: (table: string) => any };

export type ReportType = 'vehicle_check' | 'problem';
export type ReportStatus = 'open' | 'acknowledged' | 'resolved';
export type CheckVerdict = 'ok' | 'fault';

export type DriverReport = {
  id: string;
  driver_id: string;
  admin_code: string;
  type: ReportType;
  details: Record<string, string>;
  note: string | null;
  photos: string[];
  latitude: number | null;
  longitude: number | null;
  status: ReportStatus;
  has_fault: boolean;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
};

/** The shift-start checklist. Short on purpose: a long one gets tapped through. */
export const CHECK_ITEMS: { id: string; label: string; hint: string }[] = [
  { id: 'tyres', label: 'Tyres', hint: 'Pressure, cuts, tread' },
  { id: 'lights', label: 'Lights', hint: 'Head, brake, indicators' },
  { id: 'brakes', label: 'Brakes', hint: 'Feel and bite' },
  { id: 'fluids', label: 'Oil & water', hint: 'Levels and leaks' },
  { id: 'body', label: 'Body', hint: 'Dents, scratches, glass' },
  { id: 'documents', label: 'Papers', hint: 'Licence, insurance, permit' },
];

export const PROBLEM_KINDS: { id: string; label: string; emoji: string }[] = [
  { id: 'breakdown', label: 'Breakdown', emoji: '🔧' },
  { id: 'road_blocked', label: 'Road blocked', emoji: '🚧' },
  { id: 'site_closed', label: 'Site closed', emoji: '🚫' },
  { id: 'refused', label: 'Refused', emoji: '🙅' },
  { id: 'accident', label: 'Accident', emoji: '💥' },
  { id: 'other', label: 'Other', emoji: '❗' },
];

export async function createReport(input: {
  driver_id: string;
  admin_code: string;
  type: ReportType;
  details: Record<string, string>;
  note: string | null;
  photos: string[];
  latitude: number | null;
  longitude: number | null;
  has_fault: boolean;
}): Promise<void> {
  const { error } = await db.from('driver_reports').insert(input);
  if (error) throw error;
}

export async function fetchDriverReports(driverId: string, limit = 50): Promise<DriverReport[]> {
  const { data, error } = await db
    .from('driver_reports')
    .select('*')
    .eq('driver_id', driverId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DriverReport[];
}

export async function fetchFleetReports(adminCodes: string[], limit = 100): Promise<DriverReport[]> {
  if (adminCodes.length === 0) return [];
  const { data, error } = await db
    .from('driver_reports')
    .select('*')
    .in('admin_code', adminCodes)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as DriverReport[];
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
  reviewerId: string,
  note?: string
): Promise<void> {
  const { error } = await db
    .from('driver_reports')
    .update({
      status,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_note: note ?? null,
    })
    .eq('id', id);
  if (error) throw error;
}

/** Has this driver already checked the vehicle today? */
export function checkedToday(reports: DriverReport[]): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return reports.some(
    (r) => r.type === 'vehicle_check' && new Date(r.created_at) >= today
  );
}
