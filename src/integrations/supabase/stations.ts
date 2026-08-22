import { supabase } from '@/integrations/supabase/client';

/**
 * Typed access to the stations tables.
 *
 * `types.ts` is generated from the database and does not yet know about
 * `stations` / `station_assignments` / `station_visits`, so every query
 * against them would otherwise be an untyped `any` scattered through the app.
 * The cast is confined to this module: everything else imports these helpers
 * and gets real types back. Regenerate `types.ts` after the migration is
 * applied and this file can be simplified to plain `supabase.from(...)`.
 */
const db = supabase as unknown as {
  from: (table: string) => any;
};

export type StationKind =
  | 'dump_site'
  | 'pickup'
  | 'dropoff'
  | 'school'
  | 'depot'
  | 'checkpoint'
  | 'custom';

export type Recurrence = 'daily' | 'weekly' | 'once' | 'none';

export type Station = {
  id: string;
  admin_user_id: string;
  admin_code: string;
  name: string;
  kind: StationKind;
  color: string;
  notes: string | null;
  latitude: number;
  longitude: number;
  radius_m: number;
  min_dwell_seconds: number;
  requires_photo: boolean;
  recurrence: Recurrence;
  recurrence_days: number[] | null;
  window_start: string | null;
  window_end: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type StationVisit = {
  id: string;
  station_id: string;
  driver_id: string;
  admin_code: string;
  visit_date: string;
  arrived_at: string;
  departed_at: string | null;
  dwell_seconds: number | null;
  closest_distance_m: number | null;
  accuracy_m: number | null;
  photo_url: string | null;
  photo_submitted_at: string | null;
  photo_lat: number | null;
  photo_lng: number | null;
  photo_distance_m: number | null;
  status: 'arrived' | 'completed' | 'flagged';
  flag_reason: string | null;
  created_at: string;
};

export type NewStation = Omit<Station, 'id' | 'created_at' | 'updated_at'>;

/** Every station belonging to a set of connection codes. */
export async function fetchStations(adminCodes: string[]): Promise<Station[]> {
  if (adminCodes.length === 0) return [];
  const { data, error } = await db
    .from('stations')
    .select('*')
    .in('admin_code', adminCodes)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Station[];
}

/** Active stations for one driver's fleet code. */
export async function fetchStationsForDriver(adminCode: string): Promise<Station[]> {
  const { data, error } = await db
    .from('stations')
    .select('*')
    .eq('admin_code', adminCode)
    .eq('active', true);
  if (error) throw error;
  return (data ?? []) as Station[];
}

export async function createStation(station: Partial<NewStation>): Promise<Station> {
  const { data, error } = await db.from('stations').insert(station).select().single();
  if (error) throw error;
  return data as Station;
}

export async function updateStation(id: string, patch: Partial<Station>): Promise<void> {
  const { error } = await db.from('stations').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteStation(id: string): Promise<void> {
  const { error } = await db.from('stations').delete().eq('id', id);
  if (error) throw error;
}

/** Visits for one station, newest first. */
export async function fetchStationVisits(stationId: string, limit = 60): Promise<StationVisit[]> {
  const { data, error } = await db
    .from('station_visits')
    .select('*')
    .eq('station_id', stationId)
    .order('visit_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as StationVisit[];
}

/** Visits for one driver across a date range. */
export async function fetchDriverVisits(
  driverId: string,
  sinceDate: string
): Promise<StationVisit[]> {
  const { data, error } = await db
    .from('station_visits')
    .select('*')
    .eq('driver_id', driverId)
    .gte('visit_date', sinceDate)
    .order('arrived_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as StationVisit[];
}

/** Today's visits for a driver — drives the "done / still outstanding" list. */
export async function fetchTodayVisits(driverId: string): Promise<StationVisit[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from('station_visits')
    .select('*')
    .eq('driver_id', driverId)
    .eq('visit_date', today);
  if (error) throw error;
  return (data ?? []) as StationVisit[];
}

/**
 * Record (or refresh) an arrival. Upserts on the station+driver+date unique
 * index so a driver who re-enters the radius later the same day updates the
 * existing record instead of creating a duplicate.
 */
export async function recordArrival(input: {
  station_id: string;
  driver_id: string;
  admin_code: string;
  dwell_seconds: number;
  closest_distance_m: number;
  accuracy_m: number | null;
}): Promise<void> {
  const { error } = await db
    .from('station_visits')
    .upsert(
      {
        ...input,
        visit_date: new Date().toISOString().slice(0, 10),
        arrived_at: new Date().toISOString(),
        status: 'arrived',
      },
      { onConflict: 'station_id,driver_id,visit_date', ignoreDuplicates: false }
    );
  if (error) throw error;
}

/** Attach the photo receipt, completing the visit. */
export async function attachReceipt(
  visitId: string,
  receipt: {
    photo_url: string;
    photo_lat: number | null;
    photo_lng: number | null;
    photo_distance_m: number | null;
  }
): Promise<void> {
  const { error } = await db
    .from('station_visits')
    .update({
      ...receipt,
      photo_submitted_at: new Date().toISOString(),
      status: 'completed',
    })
    .eq('id', visitId);
  if (error) throw error;
}


/**
 * Which drivers each station is narrowed to.
 * A station with no rows applies to every driver on its admin_code.
 */
export async function fetchStationAssignments(
  stationIds: string[]
): Promise<Record<string, string[]>> {
  if (stationIds.length === 0) return {};
  const { data, error } = await db
    .from('station_assignments')
    .select('station_id, driver_id')
    .in('station_id', stationIds);
  if (error) throw error;

  const byStation: Record<string, string[]> = {};
  (data ?? []).forEach((row: { station_id: string; driver_id: string }) => {
    (byStation[row.station_id] ??= []).push(row.driver_id);
  });
  return byStation;
}

/** Today's visits across a whole fleet, for the dashboard's completion view. */
export async function fetchTodayVisitsForCodes(adminCodes: string[]): Promise<StationVisit[]> {
  if (adminCodes.length === 0) return [];
  const today = new Date();
  const localDay = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const { data, error } = await db
    .from('station_visits')
    .select('*')
    .in('admin_code', adminCodes)
    .eq('visit_date', localDay);
  if (error) throw error;
  return (data ?? []) as StationVisit[];
}


/**
 * Replace a station's driver list.
 *
 * An empty list means "everyone on this fleet code" rather than "nobody" —
 * that is the sane default for a shared site, and it means a manager who never
 * opens this control still gets working behaviour.
 */
export async function saveStationAssignments(
  stationId: string,
  driverIds: string[]
): Promise<void> {
  const { error: clearError } = await db
    .from('station_assignments')
    .delete()
    .eq('station_id', stationId);
  if (clearError) throw clearError;

  if (driverIds.length === 0) return;

  const { error } = await db
    .from('station_assignments')
    .insert(driverIds.map((driver_id) => ({ station_id: stationId, driver_id })));
  if (error) throw error;
}

/** Drivers on a set of fleet codes, for the assignment picker. */
export async function fetchDriversForCodes(
  adminCodes: string[]
): Promise<{ driver_id: string; driver_name: string | null }[]> {
  if (adminCodes.length === 0) return [];
  const { data, error } = await db
    .from('drivers')
    .select('driver_id, driver_name')
    .in('admin_code', adminCodes);
  if (error) throw error;
  return data ?? [];
}

/** Metres between two coordinates (haversine). */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Does this station apply today, given its recurrence rule? */
export function isDueToday(station: Station): boolean {
  if (!station.active) return false;
  switch (station.recurrence) {
    case 'daily':
      return true;
    case 'weekly':
      return (station.recurrence_days ?? []).includes(new Date().getDay());
    case 'once':
    case 'none':
      return true; // still visitable; "once" simply stops mattering after the first
    default:
      return true;
  }
}

export const STATION_KINDS: { id: StationKind; label: string; emoji: string }[] = [
  { id: 'dump_site', label: 'Dump site', emoji: '🗑️' },
  { id: 'pickup', label: 'Pickup', emoji: '📦' },
  { id: 'dropoff', label: 'Drop-off', emoji: '🏁' },
  { id: 'school', label: 'School', emoji: '🎒' },
  { id: 'depot', label: 'Depot', emoji: '🏭' },
  { id: 'checkpoint', label: 'Checkpoint', emoji: '📍' },
  { id: 'custom', label: 'Other', emoji: '⭐' },
];

export function kindMeta(kind: StationKind) {
  return STATION_KINDS.find((k) => k.id === kind) ?? STATION_KINDS[5];
}
