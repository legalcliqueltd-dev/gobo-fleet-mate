import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, serviceKey);

type Coords = { 
  latitude: number; 
  longitude: number; 
  speed?: number | null; 
  timestamp?: string | number | null 
};

function cors() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { 
    status, 
    headers: { 'Content-Type': 'application/json', ...cors() } 
  });
}

async function findValidSession(token: string) {
  const { data, error } = await supabase
    .from('temp_track_sessions')
    .select('id, owner_user_id, device_id, status, expires_at, label')
    .eq('token', token)
    .single();
  
  if (error || !data) return null;
  
  const expired = new Date(data.expires_at).getTime() < Date.now();
  if (expired || data.status === 'revoked' || data.status === 'expired') return null;
  
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const { action, token, nickname, coords } = body as {
      action: 'claim' | 'update' | 'stop';
      token: string;
      nickname?: string;
      coords?: Coords;
    };

    if (!token || !action) {
      return json({ error: 'Missing token or action' }, 400);
    }

    const session = await findValidSession(token);
    if (!session) {
      return json({ error: 'Invalid or expired session' }, 400);
    }

    // Claim: create a temporary device if none; mark claimed
    if (action === 'claim') {
      let deviceId = session.device_id;
      
      if (!deviceId) {
        const deviceName = `Temp: ${nickname || session.label || token.slice(0, 6)}`;
        
        const { data: device, error: dErr } = await supabase
          .from('devices')
          .insert([{
            user_id: session.owner_user_id,
            name: deviceName,
            imei: null,
            status: 'active',
            is_temporary: true
          }])
          .select('id')
          .single();
        
        if (dErr || !device) {
          console.error('Device create failed:', dErr);
          return json({ error: dErr?.message || 'Device create failed' }, 500);
        }
        
        deviceId = device.id;
        
        await supabase
          .from('temp_track_sessions')
          .update({ 
            device_id: deviceId, 
            guest_nickname: nickname ?? null, 
            claimed_at: new Date().toISOString(), 
            status: 'claimed' 
          })
          .eq('id', session.id);
        
        console.log(`Created temporary device ${deviceId} for session ${session.id}`);
      }
      
      return json({ ok: true, device_id: deviceId });
    }

    // Update: insert location and touch last_seen
    if (action === 'update') {
      if (!coords || typeof coords.latitude !== 'number' || typeof coords.longitude !== 'number') {
        return json({ error: 'Missing coords' }, 400);
      }
      
      if (!session.device_id) {
        return json({ error: 'Session not claimed' }, 400);
      }

      const ts = coords.timestamp 
        ? new Date(coords.timestamp).toISOString() 
        : new Date().toISOString();
      
      const { error: locErr } = await supabase
        .from('locations')
        .insert([{
          device_id: session.device_id,
          latitude: coords.latitude,
          longitude: coords.longitude,
          speed: typeof coords.speed === 'number' ? coords.speed : null,
          timestamp: ts
        }]);
      
      if (locErr) {
        console.error('Location insert failed:', locErr);
        return json({ error: locErr.message }, 500);
      }

      // Touch last_seen and set device status (simple heuristic)
      const status = (coords.speed ?? 0) >= 3 ? 'active' : 'idle';
      
      await supabase
        .from('temp_track_sessions')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', session.id);
      
      await supabase
        .from('devices')
        .update({ status })
        .eq('id', session.device_id);

      return json({ ok: true });
    }

    // Stop: revoke further updates
    if (action === 'stop') {
      await supabase
        .from('temp_track_sessions')
        .update({ status: 'revoked' })
        .eq('id', session.id);
      
      if (session.device_id) {
        await supabase
          .from('devices')
          .update({ status: 'offline' })
          .eq('id', session.device_id);
      }
      
      return json({ ok: true });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('temp-track error:', e);
    return json({ error: String(e) }, 500);
  }
});
