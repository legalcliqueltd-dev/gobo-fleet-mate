// Delivery codes — see docs/DELIVERY_CODE_SPEC.md
//
// Every operation on a delivery code happens here, with the service role,
// because the two people who use the feature are both unauthenticated: the
// driver joins with a connection code and the customer has nothing at all.
// Putting it here is also what lets rule §2.J hold — the plaintext code exists
// for exactly as long as it takes to hash it and hand it to Resend, and is
// never returned to the owner who issued it.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
// Must match the sender already verified with Resend for this domain —
// an unverified from-address is accepted by the API and then never delivered.
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';

/** Six digits. Rejected 4 because a million guesses beats ten thousand. */
function generateCode(): string {
  const n = new Uint32Array(1);
  crypto.getRandomValues(n);
  return String(n[0] % 1_000_000).padStart(6, '0');
}

function randomToken(bytes = 24): string {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function hashCode(code: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time compare, so response timing cannot leak a prefix. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function metresBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(la1) * Math.cos(la2);
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/**
 * The message the customer receives.
 *
 * One instruction line ABOVE the code, deliberately. People read the code out
 * the moment the driver appears, before opening anything, and then the feature
 * is theatre (spec §2.C). Six words change behaviour at the door.
 */
function customerEmail(opts: {
  business: string;
  code: string;
  link: string;
  what: string | null;
}) {
  return `
<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111827">
  <p style="margin:0 0 4px;font-size:13px;color:#6b7280">${opts.business}</p>
  <p style="margin:0 0 18px;font-size:16px;font-weight:600">
    Check your item first, then give the driver:
  </p>
  <p style="margin:0 0 18px;font-size:44px;font-weight:800;letter-spacing:.14em;font-variant-numeric:tabular-nums">
    ${opts.code}
  </p>
  ${opts.what ? `<p style="margin:0 0 18px;font-size:14px;color:#374151">Delivery: ${opts.what}</p>` : ''}
  <p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:#374151">
    Do not give this code until you have opened and checked your item, with the
    driver still there. If something is wrong, keep the code and report it:
  </p>
  <a href="${opts.link}"
     style="display:inline-block;padding:12px 18px;border-radius:10px;background:#111827;color:#fff;text-decoration:none;font-weight:600;font-size:14px">
    Open my delivery
  </a>
</div>`.trim();
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.error('[delivery-code] RESEND_API_KEY not configured');
    return false;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) console.error('[delivery-code] resend failed:', await res.text());
    return res.ok;
  } catch (err) {
    console.error('[delivery-code] email error:', err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action } = body as { action?: string };

    // ───────── issue / reissue ─────────
    // Called by the authenticated owner. Returns STATUS ONLY — never the code.
    if (action === 'issue') {
      const { taskId, customerName, customerPhone, customerEmail: email, expiresInMinutes, sendVia } =
        body as {
          taskId?: string;
          customerName?: string;
          customerPhone?: string;
          customerEmail?: string;
          expiresInMinutes?: number;
          sendVia?: string[];
        };

      const authHeader = req.headers.get('Authorization') ?? '';
      const jwt = authHeader.replace('Bearer ', '');
      const { data: userData } = await supabaseAdmin.auth.getUser(jwt);
      const user = userData?.user;
      if (!user) return json({ error: 'Not signed in' }, 401);

      if (!taskId) return json({ error: 'taskId is required' }, 400);

      const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('id, created_by, title, dropoff_lat, dropoff_lng')
        .eq('id', taskId)
        .maybeSingle();

      if (!task || task.created_by !== user.id) {
        return json({ error: 'Job not found' }, 404);
      }

      // Reissue kills the previous code. Never two live codes for one job.
      await supabaseAdmin
        .from('delivery_codes')
        .update({ status: 'expired' })
        .eq('task_id', taskId)
        .in('status', ['issued', 'viewed']);

      const minutes = Math.min(Math.max(expiresInMinutes ?? 1440, 15), 7 * 24 * 60);
      const code = generateCode();
      const salt = randomToken(16);
      const token = randomToken(24);

      const { data: row, error: insertErr } = await supabaseAdmin
        .from('delivery_codes')
        .insert({
          task_id: taskId,
          delivery_code_hash: await hashCode(code, salt),
          delivery_code_salt: salt,
          customer_token: token,
          customer_name: customerName ?? null,
          customer_phone: customerPhone ?? null,
          customer_email: email ?? null,
          sent_via: sendVia ?? [],
          valid_from: new Date().toISOString(),
          expires_at: new Date(Date.now() + minutes * 60_000).toISOString(),
          issued_by: user.id,
        })
        .select('id, customer_token, expires_at')
        .single();

      if (insertErr) {
        console.error('[delivery-code] insert failed:', insertErr);
        return json({ error: 'Could not create the code' }, 500);
      }

      await supabaseAdmin
        .from('tasks')
        .update({ requires_delivery_code: true })
        .eq('id', taskId);

      // Send it. The plaintext code dies with this request either way.
      const link = `https://fleettrackmate.com/d/${token}`;
      let emailed = false;
      if (email && (sendVia ?? []).includes('email')) {
        // profiles has full_name only — there is no company_name column, and
        // selecting one would error the whole request.
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .maybeSingle();
        const business = profile?.full_name || 'Your delivery';
        emailed = await sendEmail(
          email,
          `Your delivery code from ${business}`,
          customerEmail({ business, code, link, what: task.title ?? null })
        );
      }

      // NOTE: no `code` field in this response, by design (spec §2.J).
      return json({
        success: true,
        deliveryCodeId: row.id,
        customerLink: link,
        expiresAt: row.expires_at,
        emailed,
        smsPending: (sendVia ?? []).includes('sms'),
      });
    }

    // ───────── customer-view ─────────
    // The public page. Reveals the code to whoever holds the URL token.
    if (action === 'customer-view') {
      const { token } = body as { token?: string };
      if (!token) return json({ error: 'token is required' }, 400);

      const { data: row } = await supabaseAdmin
        .from('delivery_codes')
        .select(
          'id, task_id, delivery_code_salt, customer_name, expires_at, status, created_at'
        )
        .eq('customer_token', token)
        .maybeSingle();

      if (!row) return json({ error: 'not_found' }, 404);

      const expired = new Date(row.expires_at).getTime() < Date.now();
      if (expired && ['issued', 'viewed'].includes(row.status)) {
        await supabaseAdmin
          .from('delivery_codes')
          .update({ status: 'expired' })
          .eq('id', row.id);
      }

      if (row.status === 'issued') {
        await supabaseAdmin
          .from('delivery_codes')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', row.id);
      }

      const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('title, assigned_driver_id, admin_code')
        .eq('id', row.task_id)
        .maybeSingle();

      // The customer page needs the code itself. It is NOT stored, so it cannot
      // be returned — instead the page shows it only because the issuing email
      // carried it. What this returns is everything AROUND the code.
      return json({
        success: true,
        status: expired ? 'expired' : row.status,
        customerName: row.customer_name,
        what: task?.title ?? null,
        expiresAt: row.expires_at,
        driverId: task?.assigned_driver_id ?? null,
      });
    }

    // ───────── verify ─────────
    // The driver, at the door. Unauthenticated: identity comes from the
    // connection code, which is how every other driver action works here.
    if (action === 'verify') {
      const { taskId, driverId, adminCode, code, latitude, longitude } = body as {
        taskId?: string;
        driverId?: string;
        adminCode?: string;
        code?: string;
        latitude?: number;
        longitude?: number;
      };

      if (!taskId || !driverId || !adminCode || !code) {
        return json({ error: 'taskId, driverId, adminCode and code are required' }, 400);
      }

      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('driver_id')
        .eq('driver_id', driverId)
        .eq('admin_code', adminCode)
        .maybeSingle();
      if (!driver) return json({ error: 'Invalid driver identity' }, 403);

      const { data: row } = await supabaseAdmin
        .from('delivery_codes')
        .select('*')
        .eq('task_id', taskId)
        .in('status', ['issued', 'viewed'])
        .maybeSingle();

      if (!row) return json({ ok: false, reason: 'no_live_code' }, 200);

      if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
        return json({ ok: false, reason: 'locked', lockedUntil: row.locked_until }, 200);
      }

      // Expiry and a wrong code return the SAME shape deliberately: telling a
      // guesser which one they hit is free information (spec §2.E).
      if (new Date(row.expires_at).getTime() < Date.now()) {
        await supabaseAdmin
          .from('delivery_codes')
          .update({ status: 'expired' })
          .eq('id', row.id);
        return json({ ok: false, reason: 'invalid' }, 200);
      }

      const matches = safeEqual(
        await hashCode(String(code), row.delivery_code_salt),
        row.delivery_code_hash
      );

      if (!matches) {
        const attempts = (row.attempts ?? 0) + 1;
        await supabaseAdmin
          .from('delivery_codes')
          .update({
            attempts,
            locked_until:
              attempts >= 5 ? new Date(Date.now() + 15 * 60_000).toISOString() : null,
          })
          .eq('id', row.id);
        return json(
          { ok: false, reason: attempts >= 5 ? 'locked' : 'invalid', attemptsLeft: Math.max(0, 5 - attempts) },
          200
        );
      }

      // Correct. Record where it happened — the number that settles a dispute.
      const { data: task } = await supabaseAdmin
        .from('tasks')
        .select('dropoff_lat, dropoff_lng')
        .eq('id', taskId)
        .maybeSingle();

      let distance: number | null = null;
      if (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        task?.dropoff_lat != null &&
        task?.dropoff_lng != null
      ) {
        distance = metresBetween(
          { lat: latitude, lng: longitude },
          { lat: task.dropoff_lat, lng: task.dropoff_lng }
        );
      }

      await supabaseAdmin
        .from('delivery_codes')
        .update({
          status: 'redeemed',
          redeemed_at: new Date().toISOString(),
          redeemed_lat: latitude ?? null,
          redeemed_lng: longitude ?? null,
          redeemed_distance_m: distance,
          attempts: 0,
          locked_until: null,
        })
        .eq('id', row.id);

      return json({ ok: true, distanceM: distance });
    }

    // ───────── reject ─────────
    // The customer, refusing the goods, with photographs.
    if (action === 'reject') {
      const { token, reason, photos } = body as {
        token?: string;
        reason?: string;
        photos?: string[];
      };
      if (!token) return json({ error: 'token is required' }, 400);

      const { data: row } = await supabaseAdmin
        .from('delivery_codes')
        .select('id, status')
        .eq('customer_token', token)
        .maybeSingle();

      if (!row) return json({ error: 'not_found' }, 404);
      if (row.status === 'redeemed') {
        return json({ error: 'already_redeemed' }, 409);
      }

      await supabaseAdmin
        .from('delivery_codes')
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
          rejected_reason: reason ?? null,
          rejected_photos: photos ?? [],
        })
        .eq('id', row.id);

      return json({ success: true });
    }

    // ───────── refused ─────────
    // The driver's counter-claim: goods handed over, code withheld.
    if (action === 'refused') {
      const { taskId, driverId, adminCode, note } = body as {
        taskId?: string;
        driverId?: string;
        adminCode?: string;
        note?: string;
      };
      if (!taskId || !driverId || !adminCode) {
        return json({ error: 'taskId, driverId and adminCode are required' }, 400);
      }

      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('driver_id')
        .eq('driver_id', driverId)
        .eq('admin_code', adminCode)
        .maybeSingle();
      if (!driver) return json({ error: 'Invalid driver identity' }, 403);

      await supabaseAdmin
        .from('delivery_codes')
        .update({
          status: 'refused',
          refused_at: new Date().toISOString(),
          refused_note: note ?? null,
        })
        .eq('task_id', taskId)
        .in('status', ['issued', 'viewed']);

      return json({ success: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[delivery-code] unhandled:', err);
    return json({ error: 'Server error' }, 500);
  }
});
