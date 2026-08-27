import { supabase } from '@/integrations/supabase/client';

/**
 * The manager's own identity, and the number their drivers ring.
 *
 * Both were previously unreachable after signup: `full_name` was captured once
 * on the signup form and never editable again, and the emergency contact could
 * only be set from the website's Settings page — which is the wrong place for
 * it, because the number a driver dials in an emergency is exactly the thing
 * that changes while you are away from a desk.
 *
 * These two live together because they are the same fact from two directions:
 * who the manager is, and how to reach them.
 */

/**
 * A display name is stored in two places and both must move together.
 *
 * `auth.users.user_metadata.full_name` is what the client already has in hand
 * on every screen (`user.user_metadata.full_name`), so it is what the app
 * renders. `profiles.full_name` is what server-side code and other people's
 * queries read — the daily report, the platform console, the emails. Update
 * one and the app disagrees with its own emails.
 */
export async function updateDisplayName(userId: string, fullName: string): Promise<void> {
  const name = fullName.trim();
  if (!name) throw new Error('Enter your name.');

  // Auth metadata first: it is the one the UI reads back immediately, and a
  // failure here is the one the user would actually notice.
  const { error: authErr } = await supabase.auth.updateUser({ data: { full_name: name } });
  if (authErr) throw authErr;

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ full_name: name })
    .eq('id', userId);
  if (profileErr) throw profileErr;
}

export interface AdminContact {
  name: string;
  phone: string;
}

/**
 * Every connection code this manager owns.
 *
 * The emergency contact is stored per `admin_code` rather than per user — the
 * drivers reading it are unauthenticated and only know their code — so setting
 * it means writing one row per device the manager owns.
 */
async function loadConnectionCodes(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('devices')
    .select('connection_code')
    .eq('user_id', userId);
  if (error) throw error;

  return (data ?? [])
    .map((d) => d.connection_code)
    .filter((c): c is string => typeof c === 'string' && c.length > 0);
}

/** The contact drivers currently see, or null when none is set. */
export async function fetchAdminContact(
  userId: string
): Promise<{ contact: AdminContact | null; codes: string[] }> {
  const codes = await loadConnectionCodes(userId);
  if (codes.length === 0) return { contact: null, codes };

  const { data, error } = await supabase
    .from('emergency_contacts')
    .select('contact_name, contact_phone')
    .in('admin_code', codes)
    .eq('is_active', true)
    .order('contact_type', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw error;

  const row = data?.[0];
  if (!row?.contact_phone) return { contact: null, codes };

  return { contact: { name: row.contact_name ?? '', phone: row.contact_phone }, codes };
}

/**
 * Point every one of this manager's codes at a new number.
 *
 * Delete-then-insert rather than upsert: the existing schema has no unique
 * constraint shaped like (admin_code, contact_type), so an upsert would have
 * nothing to conflict on and would simply accumulate duplicate rows — which
 * the driver-side query would then resolve to an arbitrary one of them.
 *
 * Returns how many codes were updated so the caller can say so.
 */
export async function saveAdminContact(
  userId: string,
  contact: AdminContact
): Promise<number> {
  const phone = contact.phone.trim();
  if (!phone) throw new Error('A phone number is required.');

  const codes = await loadConnectionCodes(userId);
  if (codes.length === 0) {
    throw new Error('Add a driver first — the contact is attached to your connection code.');
  }

  const name = contact.name.trim() || 'Fleet Administrator';

  const { error: delErr } = await supabase
    .from('emergency_contacts')
    .delete()
    .in('admin_code', codes)
    .eq('contact_type', 'admin');
  if (delErr) throw delErr;

  const { error: insErr } = await supabase.from('emergency_contacts').insert(
    codes.map((code) => ({
      admin_code: code,
      contact_name: name,
      contact_phone: phone,
      contact_type: 'admin',
      contact_role: 'Fleet Administrator',
      is_active: true,
    }))
  );
  if (insErr) throw insErr;

  return codes.length;
}

/** Remove the contact; drivers fall back to a "not set" state on the SOS screen. */
export async function clearAdminContact(userId: string): Promise<void> {
  const codes = await loadConnectionCodes(userId);
  if (codes.length === 0) return;

  const { error } = await supabase
    .from('emergency_contacts')
    .delete()
    .in('admin_code', codes)
    .eq('contact_type', 'admin');
  if (error) throw error;
}

/** Buckets reject anything larger; resize before we ever hit the network. */
const AVATAR_MAX_PX = 512;

/**
 * Shrink to a square JPEG before upload.
 *
 * A modern phone camera produces 3–8 MB, which the bucket's 2 MB cap would
 * reject outright — and a manager whose photo silently fails to save has no
 * way to know why. Resizing client-side means the upload is ~50 KB and the
 * limit is never approached, rather than being a trap.
 *
 * Centre-cropped because every place this renders is a circle; letting the
 * browser squash a portrait into one looks broken.
 */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = AVATAR_MAX_PX;
  canvas.height = AVATAR_MAX_PX;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process that image.');

  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    AVATAR_MAX_PX,
    AVATAR_MAX_PX
  );
  bitmap.close();

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not process that image.'))),
      'image/jpeg',
      0.85
    )
  );
}

/**
 * Upload a new profile picture and record it on the profile.
 *
 * The path is `admin/<uid>/…`, which the storage policy requires: the uid
 * segment is what stops one manager overwriting another's picture. The
 * timestamped filename means the CDN never serves a stale image after a
 * change, which `upsert` on a fixed name would.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await toSquareJpeg(file);
  const path = `admin/${userId}/${Date.now()}.jpg`;

  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;

  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;

  const { error: profErr } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', userId);
  if (profErr) throw profErr;

  // Mirrored into auth metadata for the same reason the name is: it is what
  // the client already has on every screen without another query.
  await supabase.auth.updateUser({ data: { avatar_url: url } });

  return url;
}

/** Remove the picture. The stored object is left; the reference is what shows. */
export async function clearAvatar(userId: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId);
  if (error) throw error;
  await supabase.auth.updateUser({ data: { avatar_url: null } });
}
