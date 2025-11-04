// Supabase Edge Function (Deno) — notify-inactivity
// Sends FCM notifications for devices that newly became offline.
// Deploy with Supabase CLI; set secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FCM_SERVER_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const fcmKey = Deno.env.get('FCM_SERVER_KEY')!;

const supabase = createClient(supabaseUrl, serviceKey);

async function sendFcm(tokens: string[], title: string, body: string, data: Record<string, string> = {}) {
  if (!tokens.length) return { success: 0, failure: 0 };
  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Authorization': `key=${fcmKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      registration_ids: tokens.slice(0, 900), // safety margin
      notification: { title, body },
      data,
      priority: 'high',
    }),
  });
  const json = await res.json().catch(() => ({}));
  return json;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors() });
  }

  const url = new URL(req.url);
  const testUser = url.searchParams.get('test_user'); // optional test mode

  try {
    if (testUser) {
      // Send a test notification to a specific user id
      const { data: tokens, error: tErr } = await supabase
        .from('notification_tokens')
        .select('token')
        .eq('user_id', testUser);
      if (tErr) throw tErr;
      const payload = await sendFcm(
        tokens?.map((t) => t.token) ?? [],
        'FleetTrackMate',
        'Test notification'
      );
      return json({ mode: 'test', tokens: tokens?.length ?? 0, payload }, 200);
    }

    // Find devices newly offline (status offline AND not yet notified since status change)
    const { data: devices, error: dErr } = await supabase
      .from('devices')
      .select('id, user_id, name, status, status_changed_at, last_notified_offline_at')
      .eq('status', 'offline');

    if (dErr) throw dErr;

    const toNotify = (devices ?? []).filter((d) => {
      if (!d.status_changed_at) return false;
      if (!d.last_notified_offline_at) return true;
      return new Date(d.last_notified_offline_at).getTime() < new Date(d.status_changed_at).getTime();
    });

    let sent = 0;
    for (const d of toNotify) {
      const { data: toks, error: tErr } = await supabase
        .from('notification_tokens')
        .select('token')
        .eq('user_id', d.user_id);

      if (tErr) continue;

      const title = 'Device offline';
      const body = `${d.name ?? 'Device'} is offline.`;
      const resp = await sendFcm((toks ?? []).map((t) => t.token), title, body, { device_id: d.id });

      // Mark notified
      await supabase
        .from('devices')
        .update({ last_notified_offline_at: new Date().toISOString() })
        .eq('id', d.id);

      sent += (resp?.success as number) ?? 0;
    }

    return json({ scanned: devices?.length ?? 0, toNotify: toNotify.length, sent }, 200);
  } catch (e) {
    console.error('notify-inactivity error:', e);
    return json({ error: String(e) }, 500);
  }
});

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
