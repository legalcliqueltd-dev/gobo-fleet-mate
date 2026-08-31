import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Platform operator console backend.
 *
 * Everything here reads or writes across ALL tenants, so it runs as
 * service_role and is gated on one thing: the caller holding the
 * `platform_owner` role.
 *
 * That role exists precisely because `role = 'admin'` does not gate anything —
 * the signup trigger grants 'admin' to every account, which is how `bulk-email`
 * came to be callable by any customer. Do not "simplify" this check back to
 * 'admin'.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

type Actor = { id: string; email: string | null };

/** Resolve the caller, or null if they are not a platform operator. */
async function authorize(req: Request): Promise<Actor | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const { data, error } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  if (error || !data.user) return null;

  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', data.user.id)
    .eq('role', 'platform_owner')
    .maybeSingle();
  if (!role) return null;

  return { id: data.user.id, email: data.user.email ?? null };
}

async function writeAudit(
  actor: Actor,
  action: string,
  details: Record<string, unknown>,
  target?: { id?: string | null; email?: string | null }
) {
  const { error } = await supabase.from('platform_audit_log').insert({
    actor_id: actor.id,
    actor_email: actor.email,
    action,
    target_id: target?.id ?? null,
    target_email: target?.email ?? null,
    details,
  });
  // A failed audit write must not silently accompany a successful mutation.
  if (error) console.error('platform-admin: AUDIT WRITE FAILED', action, error.message);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const actor = await authorize(req);
    if (!actor) return json({ error: 'Platform owner access required' }, 403);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? 'stats';

    // ── Aggregate numbers for the console header ──────────────────────────
    if (action === 'stats') {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, subscription_status, subscription_plan, created_at, trial_started_at');
      if (error) throw error;

      const rows = profiles ?? [];
      const by = (pred: (r: typeof rows[number]) => boolean) => rows.filter(pred).length;

      const active = rows.filter((r) => r.subscription_status === 'active');
      // Headline revenue only — the real figure lives with the processors, and
      // pretending otherwise here would invent a number nobody can reconcile.
      const mrrUsd = active.reduce(
        (sum, r) => sum + (r.subscription_plan === 'pro' ? 3.99 : 1.99),
        0
      );

      const since = (days: number) => {
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        return rows.filter((r) => r.created_at && new Date(r.created_at).getTime() >= cutoff).length;
      };

      return json({
        total: rows.length,
        active: active.length,
        pro: by((r) => r.subscription_status === 'active' && r.subscription_plan === 'pro'),
        basic: by((r) => r.subscription_status === 'active' && r.subscription_plan !== 'pro'),
        trial: by((r) => r.subscription_status === 'trial'),
        expired: by((r) => r.subscription_status === 'expired'),
        mrrUsd: Math.round(mrrUsd * 100) / 100,
        signups7d: since(7),
        signups30d: since(30),
      });
    }

    // ── Searchable user list ──────────────────────────────────────────────
    if (action === 'list-users') {
      const search: string = (body.search ?? '').trim();
      const limit = Math.min(Number(body.limit) || 50, 200);

      let query = supabase
        .from('profiles')
        .select('id, email, full_name, subscription_status, subscription_plan, subscription_end_at, payment_provider, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (search) query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;
      return json({ users: data ?? [] });
    }

    // ── Grant or change a plan without a payment ──────────────────────────
    if (action === 'grant-plan') {
      const targetId: string = body.userId;
      const plan: string = body.plan;            // 'basic' | 'pro'
      const status: string = body.status;        // 'active' | 'trial' | 'expired'
      const months = Math.min(Math.max(Number(body.months) || 1, 1), 24);
      const reason: string = (body.reason ?? '').trim();

      if (!targetId) return json({ error: 'userId is required' }, 400);
      if (!['basic', 'pro'].includes(plan)) return json({ error: 'plan must be basic or pro' }, 400);
      if (!['active', 'trial', 'expired'].includes(status)) {
        return json({ error: 'status must be active, trial or expired' }, 400);
      }
      if (!reason) return json({ error: 'A reason is required — it goes in the audit log' }, 400);

      const { data: before, error: beforeErr } = await supabase
        .from('profiles')
        .select('email, subscription_status, subscription_plan, subscription_end_at')
        .eq('id', targetId)
        .maybeSingle();
      if (beforeErr) throw beforeErr;
      if (!before) return json({ error: 'No such user' }, 404);

      const endsAt =
        status === 'active'
          ? new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000).toISOString()
          : null;

      const { error: updErr } = await supabase
        .from('profiles')
        .update({
          subscription_status: status,
          subscription_plan: plan,
          subscription_end_at: endsAt,
          // Marks the row as not originating from a processor, so billing
          // reconciliation can tell a comp from a real payment.
          payment_provider: 'manual',
        })
        .eq('id', targetId);
      if (updErr) throw updErr;

      // Mirror onto admin_subscriptions, which is what the driver-limit checks
      // read. Leaving these two disagreeing is how someone ends up on Pro with
      // a Basic driver cap.
      const { error: subErr } = await supabase
        .from('admin_subscriptions')
        .upsert(
          {
            user_id: targetId,
            plan_name: plan,
            driver_limit: plan === 'pro' ? 9999 : 2,
            status: status === 'active' ? 'active' : status,
          },
          { onConflict: 'user_id' }
        );
      if (subErr) console.warn('platform-admin: admin_subscriptions mirror failed:', subErr.message);

      await writeAudit(
        actor,
        'grant-plan',
        {
          from: {
            status: before.subscription_status,
            plan: before.subscription_plan,
            ends_at: before.subscription_end_at,
          },
          to: { status, plan, ends_at: endsAt },
          months,
          reason,
        },
        { id: targetId, email: before.email }
      );

      return json({ success: true, plan, status, endsAt });
    }

    // ── Recent operator activity ──────────────────────────────────────────
    if (action === 'audit-log') {
      const { data, error } = await supabase
        .from('platform_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(Math.min(Number(body.limit) || 50, 200));
      if (error) throw error;
      return json({ entries: data ?? [] });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error('platform-admin error:', err);
    return json({ error: err instanceof Error ? err.message : 'Unexpected error' }, 500);
  }
});
