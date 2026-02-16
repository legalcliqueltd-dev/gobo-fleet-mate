import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.78.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';
const APP_URL = 'https://gobo-fleet-mate.lovable.app';

async function sendEmailNotification(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    });
    const data = await res.json();
    if (!res.ok) console.error('Email error:', data);
    else console.log('Email sent:', data.id);
  } catch (err) { console.error('Email send failed:', err); }
}

function makeEmailHtml(title: string, body: string, actionUrl?: string, actionLabel?: string) {
  const btn = actionUrl && actionLabel ? `<div style="text-align:center;margin:24px 0;"><a href="${actionUrl}" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${actionLabel}</a></div>` : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;">🚛 FleetTrackMate</h1></div><div style="padding:24px;"><h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">${title}</h2><div style="color:#475569;font-size:14px;line-height:1.6;">${body}</div>${btn}</div><div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because you have a FleetTrackMate account.</p></div></div></div></body></html>`;
}

// Generate a unique driver ID
function generateDriverId(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req) => {
  console.log('=== CONNECT-DRIVER FUNCTION INVOKED ===');
  console.log('Method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const body = await req.json();
    const { action, code, driverName, driverId } = body;
    console.log('Action:', action, 'Code:', code, 'DriverName:', driverName, 'DriverId:', driverId);

    // Always include server_time in responses for clock sync
    const serverTime = new Date().toISOString();

    // === INPUT VALIDATION HELPERS ===
    const validateConnectionCode = (codeInput: string | undefined): string | null => {
      if (!codeInput?.trim()) return 'Connection code is required';
      const trimmed = codeInput.trim().toUpperCase();
      if (trimmed.length !== 8) return 'Connection code must be 8 characters';
      if (!/^[A-Z0-9]+$/.test(trimmed)) return 'Connection code must be alphanumeric';
      return null;
    };

    const validateDriverName = (name: string | undefined): string | null => {
      if (!name?.trim()) return 'Driver name is required';
      if (name.trim().length > 100) return 'Driver name must be 100 characters or less';
      return null;
    };

    const validateLatitude = (lat: number | undefined): boolean => {
      return lat !== undefined && lat >= -90 && lat <= 90;
    };

    const validateLongitude = (lng: number | undefined): boolean => {
      return lng !== undefined && lng >= -180 && lng <= 180;
    };

    const validateBatteryLevel = (level: number | undefined): boolean => {
      return level === undefined || (level >= 0 && level <= 100);
    };

    const validateSpeed = (speed: number | undefined): boolean => {
      return speed === undefined || (speed >= 0 && speed <= 500);
    };

    // === HELPER: Validate driver identity ===
    const validateDriverIdentity = async (did: string, acode: string) => {
      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('driver_id, admin_code, driver_name, status')
        .eq('driver_id', did)
        .eq('admin_code', acode)
        .maybeSingle();
      return driver;
    };

    // ========================================
    // ACTION: get-tasks
    // ========================================
    if (action === 'get-tasks') {
      const { adminCode, statuses } = body;
      if (!driverId || !adminCode) {
        return new Response(
          JSON.stringify({ error: 'driverId and adminCode are required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const driver = await validateDriverIdentity(driverId, adminCode);
      if (!driver) {
        return new Response(
          JSON.stringify({ error: 'Invalid driver identity', server_time: serverTime }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const statusFilter = statuses || ['assigned', 'en_route', 'completed'];
      const { data: tasks, error: tasksError } = await supabaseAdmin
        .from('tasks')
        .select('id, title, description, dropoff_lat, dropoff_lng, pickup_lat, pickup_lng, status, due_at, admin_code')
        .eq('assigned_driver_id', driverId)
        .in('status', statusFilter)
        .order('due_at', { ascending: true });

      if (tasksError) {
        console.error('Tasks query error:', tasksError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch tasks', server_time: serverTime }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ tasks: tasks || [], server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // ACTION: get-task
    // ========================================
    if (action === 'get-task') {
      const { taskId, adminCode } = body;
      if (!driverId || !adminCode || !taskId) {
        return new Response(
          JSON.stringify({ error: 'driverId, adminCode and taskId are required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const driver = await validateDriverIdentity(driverId, adminCode);
      if (!driver) {
        return new Response(
          JSON.stringify({ error: 'Invalid driver identity', server_time: serverTime }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: task, error: taskError } = await supabaseAdmin
        .from('tasks')
        .select('id, title, description, dropoff_lat, dropoff_lng, pickup_lat, pickup_lng, status, due_at, admin_code')
        .eq('id', taskId)
        .eq('assigned_driver_id', driverId)
        .maybeSingle();

      if (taskError) {
        console.error('Task query error:', taskError);
        return new Response(
          JSON.stringify({ error: 'Failed to fetch task', server_time: serverTime }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!task) {
        return new Response(
          JSON.stringify({ error: 'Task not found', server_time: serverTime }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ task, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // ACTION: update-task-status
    // ========================================
    if (action === 'update-task-status') {
      const { taskId, adminCode, status } = body;
      if (!driverId || !adminCode || !taskId || !status) {
        return new Response(
          JSON.stringify({ error: 'driverId, adminCode, taskId and status are required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const driver = await validateDriverIdentity(driverId, adminCode);
      if (!driver) {
        return new Response(
          JSON.stringify({ error: 'Invalid driver identity', server_time: serverTime }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateError } = await supabaseAdmin
        .from('tasks')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('assigned_driver_id', driverId);

      if (updateError) {
        console.error('Task update error:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update task', server_time: serverTime }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // ACTION: submit-task-report
    // ========================================
    if (action === 'submit-task-report') {
      const { taskId, adminCode, delivered, photos, note, latitude, longitude, distance_to_dropoff_m, verified_by } = body;
      if (!driverId || !adminCode || !taskId) {
        return new Response(
          JSON.stringify({ error: 'driverId, adminCode and taskId are required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const driver = await validateDriverIdentity(driverId, adminCode);
      if (!driver) {
        return new Response(
          JSON.stringify({ error: 'Invalid driver identity', server_time: serverTime }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Insert the task report using service role
      const { error: reportError } = await supabaseAdmin
        .from('task_reports')
        .insert({
          task_id: taskId,
          reporter_user_id: '00000000-0000-0000-0000-000000000000',
          delivered: delivered ?? true,
          photos: photos || null,
          note: note || null,
          latitude: latitude || null,
          longitude: longitude || null,
          distance_to_dropoff_m: distance_to_dropoff_m || null,
          verified_by: verified_by || 'none',
        });

      if (reportError) {
        console.error('Task report insert error:', reportError);
        return new Response(
          JSON.stringify({ error: 'Failed to submit report', server_time: serverTime }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update task status to completed
      const { error: taskUpdateError } = await supabaseAdmin
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId)
        .eq('assigned_driver_id', driverId);
      
      if (taskUpdateError) {
        console.error('Task status update error:', taskUpdateError);
      } else {
        console.log('Task status updated to completed, taskId:', taskId);
        
        // Send email to task creator
        try {
          const { data: task } = await supabaseAdmin
            .from('tasks')
            .select('title, created_by')
            .eq('id', taskId)
            .maybeSingle();

          if (task?.created_by) {
            const { data: creatorProfile } = await supabaseAdmin
              .from('profiles')
              .select('email, full_name')
              .eq('id', task.created_by)
              .maybeSingle();

            if (creatorProfile?.email) {
              const driverLabel = driver?.driver_name || 'A driver';
              const emailBody = `
                <p>Hi ${creatorProfile.full_name || 'there'},</p>
                <p>Great news! The task "<strong>${task.title}</strong>" has been <strong>completed</strong> by <strong>${driverLabel}</strong>.</p>
                <p><strong>Delivery status:</strong> ${delivered ? '✅ Delivered' : '❌ Not delivered'}</p>
                ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
                <p>Time: ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC</p>
              `;
              const html = makeEmailHtml('Task Completed', emailBody, `${APP_URL}/admin/tasks`, 'View Tasks');
              await sendEmailNotification(creatorProfile.email, `✅ Task Completed: ${task.title}`, html);
            }
          }
        } catch (emailErr) {
          console.error('Task completion email error:', emailErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'connect') {
      // Validate connection code format
      const codeError = validateConnectionCode(code);
      if (codeError) {
        return new Response(
          JSON.stringify({ error: codeError, server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate driver name
      const nameError = validateDriverName(driverName);
      if (nameError) {
        return new Response(
          JSON.stringify({ error: nameError, server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Find device with this connection code
      const { data: device, error: deviceError } = await supabaseAdmin
        .from('devices')
        .select('id, user_id, name, connected_driver_id, connection_code')
        .eq('connection_code', code.trim().toUpperCase())
        .maybeSingle();

      if (deviceError) {
        console.error('Device lookup error:', deviceError);
        return new Response(
          JSON.stringify({ error: 'Failed to find device', server_time: serverTime }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!device) {
        return new Response(
          JSON.stringify({ error: 'Invalid connection code', server_time: serverTime }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if this code is already assigned to a driver
      const { data: existingDriver } = await supabaseAdmin
        .from('drivers')
        .select('driver_id, driver_name, admin_code')
        .eq('admin_code', code.trim().toUpperCase())
        .maybeSingle();

      // If driverId is provided, check if it's the same driver reconnecting
      const isReconnecting = driverId && existingDriver && existingDriver.driver_id === driverId;
      
      // If code is assigned to a different driver, reconnect as that driver (same name check)
      if (existingDriver && !isReconnecting) {
        console.log('Code already assigned to driver:', existingDriver.driver_id, 'Reconnecting...');
        
        // Update the existing driver's status and reconnect
        await supabaseAdmin
          .from('drivers')
          .update({
            status: 'active',
            last_seen_at: new Date().toISOString(),
            connected_at: new Date().toISOString(),
          })
          .eq('driver_id', existingDriver.driver_id);

        // Update device connection
        await supabaseAdmin
          .from('devices')
          .update({
            connected_driver_id: existingDriver.driver_id,
            connected_at: new Date().toISOString(),
            status: 'active',
          })
          .eq('id', device.id);

        return new Response(
          JSON.stringify({ 
            success: true, 
            driverId: existingDriver.driver_id,
            device: { id: device.id, name: device.name },
            reconnected: true,
            existingDriverName: existingDriver.driver_name,
            server_time: serverTime,
            config: {
              locationUpdateIntervalMs: 10000,
              heartbeatIntervalMs: 30000,
              stationaryIntervalMs: 60000,
              lowBatteryIntervalMs: 120000,
              accuracyThresholdM: 30,
            }
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let finalDriverId: string;

      if (isReconnecting) {
        console.log('Same driver reconnecting:', driverId);
        finalDriverId = driverId;
        
        await supabaseAdmin
          .from('drivers')
          .update({
            driver_name: driverName.trim(),
            status: 'active',
            last_seen_at: new Date().toISOString(),
            connected_at: new Date().toISOString(),
          })
          .eq('driver_id', driverId);
      } else {
        finalDriverId = generateDriverId();
        console.log('Creating new driver:', finalDriverId, 'with code:', code);
        
        const { error: insertError } = await supabaseAdmin
          .from('drivers')
          .insert({
            driver_id: finalDriverId,
            admin_code: code.trim().toUpperCase(),
            driver_name: driverName.trim(),
            status: 'active',
            connected_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('Error creating driver:', insertError);
          return new Response(
            JSON.stringify({ error: 'Failed to register driver', server_time: serverTime }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update device connection
      await supabaseAdmin
        .from('devices')
        .update({
          connected_driver_id: finalDriverId,
          connected_at: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', device.id);

      // Send email to admin when a NEW driver connects (not reconnecting)
      if (!isReconnecting && device.user_id) {
        try {
          const { data: adminProfile } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .eq('id', device.user_id)
            .maybeSingle();

          if (adminProfile?.email) {
            const emailBody = `
              <p>Hi ${adminProfile.full_name || 'there'},</p>
              <p>A new driver has connected to your fleet:</p>
              <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0;"><strong>Driver Name:</strong> ${driverName.trim()}</p>
                <p style="margin:4px 0 0;"><strong>Device:</strong> ${device.name || 'N/A'}</p>
                <p style="margin:4px 0 0;"><strong>Connected at:</strong> ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })} UTC</p>
              </div>
            `;
            const html = makeEmailHtml('New Driver Connected', emailBody, `${APP_URL}/admin/drivers`, 'View Drivers');
            await sendEmailNotification(adminProfile.email, `🆕 New Driver Connected: ${driverName.trim()}`, html);
          }
        } catch (emailErr) {
          console.error('New driver email error:', emailErr);
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          driverId: finalDriverId,
          device: { id: device.id, name: device.name },
          server_time: serverTime,
          config: {
            locationUpdateIntervalMs: 10000,
            heartbeatIntervalMs: 30000,
            stationaryIntervalMs: 60000,
            lowBatteryIntervalMs: 120000,
            accuracyThresholdM: 30,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabaseAdmin
        .from('drivers')
        .update({ status: 'offline', last_seen_at: new Date().toISOString() })
        .eq('driver_id', driverId);

      await supabaseAdmin
        .from('devices')
        .update({
          connected_driver_id: null,
          connected_at: null,
          status: 'offline',
        })
        .eq('connected_driver_id', driverId);

      return new Response(
        JSON.stringify({ success: true, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-connection') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ connected: false, device: null, server_time: serverTime }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('admin_code, driver_name, status')
        .eq('driver_id', driverId)
        .maybeSingle();

      if (!driver || driver.status === 'offline') {
        return new Response(
          JSON.stringify({ connected: false, device: null, server_time: serverTime }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: device } = await supabaseAdmin
        .from('devices')
        .select('id, name')
        .eq('connection_code', driver.admin_code)
        .maybeSingle();

      return new Response(
        JSON.stringify({ 
          connected: true,
          device: device ? { id: device.id, name: device.name } : null,
          driverName: driver.driver_name,
          server_time: serverTime
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // ACTION: update-sos-photo
    // ========================================
    if (action === 'update-sos-photo') {
      const { adminCode, sosId, photoUrl } = body;
      if (!driverId || !adminCode || !sosId || !photoUrl) {
        return new Response(
          JSON.stringify({ error: 'driverId, adminCode, sosId and photoUrl are required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const driver = await validateDriverIdentity(driverId, adminCode);
      if (!driver) {
        return new Response(
          JSON.stringify({ error: 'Invalid driver identity', server_time: serverTime }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { error: updateErr } = await supabaseAdmin
        .from('sos_events')
        .update({ photo_url: photoUrl })
        .eq('id', sosId)
        .eq('driver_id', driverId);

      if (updateErr) {
        console.error('SOS photo update error:', updateErr);
        return new Response(
          JSON.stringify({ error: 'Failed to update SOS photo', server_time: serverTime }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========================================
    // ACTION: sync-trail
    // ========================================
    if (action === 'sync-trail') {
      const { adminCode, trailPoints } = body;
      if (!driverId || !adminCode || !Array.isArray(trailPoints) || trailPoints.length === 0) {
        return new Response(
          JSON.stringify({ error: 'driverId, adminCode and trailPoints array are required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const driver = await validateDriverIdentity(driverId, adminCode);
      if (!driver) {
        return new Response(
          JSON.stringify({ error: 'Invalid driver identity', server_time: serverTime }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const historyRows: any[] = [];
      for (const pt of trailPoints.slice(-100)) {
        const lat = pt.lat ?? pt.latitude;
        const lng = pt.lng ?? pt.longitude;
        if (!validateLatitude(lat) || !validateLongitude(lng)) continue;
        historyRows.push({
          driver_id: driverId,
          admin_code: adminCode,
          latitude: lat,
          longitude: lng,
          speed: pt.speed ?? null,
          accuracy: pt.accuracy ?? null,
          recorded_at: pt.timestamp ? new Date(pt.timestamp).toISOString() : new Date().toISOString(),
        });
      }

      let stored = 0;
      if (historyRows.length > 0) {
        const { error: insertErr } = await supabaseAdmin.from('driver_location_history').insert(historyRows);
        if (insertErr) {
          console.error('Trail sync insert error:', insertErr);
        } else {
          stored = historyRows.length;
        }
      }

      // Also update heartbeat
      await supabaseAdmin
        .from('drivers')
        .update({ status: 'active', last_seen_at: new Date().toISOString() })
        .eq('driver_id', driverId);

      return new Response(
        JSON.stringify({ success: true, stored, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-status') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('driver_id')
        .eq('driver_id', driverId)
        .maybeSingle();

      if (!driver) {
        return new Response(
          JSON.stringify({ error: 'Driver not found', requiresRelogin: true, server_time: serverTime }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { status, batteryLevel } = body;
      
      const updateData: any = { 
        status: status || 'active',
        last_seen_at: new Date().toISOString() 
      };
      
      if (batteryLevel !== undefined) {
        updateData.device_info = { batteryLevel, lastBatteryUpdate: serverTime };
      }
      
      await supabaseAdmin
        .from('drivers')
        .update(updateData)
        .eq('driver_id', driverId);

      return new Response(
        JSON.stringify({ success: true, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-name') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { name } = body;
      
      if (!name?.trim()) {
        return new Response(
          JSON.stringify({ error: 'Name is required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabaseAdmin
        .from('drivers')
        .update({ driver_name: name.trim() })
        .eq('driver_id', driverId);

      return new Response(
        JSON.stringify({ success: true, server_time: serverTime }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'update-location') {
      if (!driverId) {
        return new Response(
          JSON.stringify({ error: 'Driver ID is required', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // === Parse location from either flat payload or Transistorsoft plugin format ===
      let latitude = body.latitude;
      let longitude = body.longitude;
      let speed = body.speed;
      let accuracyVal = body.accuracy;
      let bearing = body.bearing;
      let batteryLevel = body.batteryLevel;
      const isBackground = body.isBackground;

      // Transistorsoft single-location payload: { location: { coords: {...}, battery: {...} } }
      if (body.location?.coords) {
        const coords = body.location.coords;
        latitude = coords.latitude;
        longitude = coords.longitude;
        speed = coords.speed != null ? coords.speed * 3.6 : null; // m/s -> km/h
        accuracyVal = coords.accuracy;
        bearing = coords.heading;
        if (body.location.battery?.level != null) {
          batteryLevel = Math.round(body.location.battery.level * 100); // 0-1 -> 0-100
        }
      }

      // Transistorsoft batch payload: { locations: [...] }
      if (Array.isArray(body.locations) && body.locations.length > 0) {
        console.log(`[Batch] Processing ${body.locations.length} locations`);
        
        // Get driver's admin_code once
        const { data: batchDriver } = await supabaseAdmin
          .from('drivers')
          .select('admin_code, device_info')
          .eq('driver_id', driverId)
          .maybeSingle();

        if (!batchDriver) {
          return new Response(
            JSON.stringify({ error: 'Driver not found', requiresRelogin: true, server_time: serverTime }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        let newestAccurateLocation: any = null;
        const historyRows: any[] = [];

        for (const loc of body.locations) {
          const c = loc.coords || loc;
          const lat = c.latitude;
          const lng = c.longitude;
          const spd = c.speed != null ? c.speed * 3.6 : null;
          const acc = c.accuracy || 0;

          if (!validateLatitude(lat) || !validateLongitude(lng)) continue;
          
          if (acc <= 30) {
            historyRows.push({
              driver_id: driverId,
              admin_code: batchDriver.admin_code,
              latitude: lat,
              longitude: lng,
              speed: spd,
              accuracy: acc,
              recorded_at: loc.timestamp ? new Date(loc.timestamp).toISOString() : new Date().toISOString(),
            });

            if (!newestAccurateLocation || (loc.timestamp && new Date(loc.timestamp) > new Date(newestAccurateLocation.timestamp))) {
              newestAccurateLocation = { latitude: lat, longitude: lng, speed: spd, accuracy: acc, timestamp: loc.timestamp };
            }
          }
        }

        // Insert history rows (limit to last 50)
        if (historyRows.length > 0) {
          const toInsert = historyRows.slice(-50);
          const { error: histErr } = await supabaseAdmin.from('driver_location_history').insert(toInsert);
          if (histErr) console.error('Batch history insert error:', histErr);
        }

        // Update current location with newest accurate point
        if (newestAccurateLocation) {
          await supabaseAdmin.from('driver_locations').upsert({
            driver_id: driverId,
            admin_code: batchDriver.admin_code,
            latitude: newestAccurateLocation.latitude,
            longitude: newestAccurateLocation.longitude,
            speed: newestAccurateLocation.speed,
            accuracy: newestAccurateLocation.accuracy,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'driver_id' });
        }

        // Update heartbeat
        let bBattery = batteryLevel;
        if (!bBattery && body.locations[body.locations.length - 1]?.battery?.level != null) {
          bBattery = Math.round(body.locations[body.locations.length - 1].battery.level * 100);
        }
        const batchDriverUpdate: any = { status: 'active', last_seen_at: new Date().toISOString() };
        if (bBattery !== undefined) {
          batchDriverUpdate.device_info = { ...(batchDriver.device_info || {}), batteryLevel: bBattery, lastUpdate: serverTime };
        }
        await supabaseAdmin.from('drivers').update(batchDriverUpdate).eq('driver_id', driverId);

        return new Response(
          JSON.stringify({ success: true, stored: historyRows.length, server_time: serverTime }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Diagnostic logging
      console.log('Raw location payload - lat:', latitude, '(type:', typeof latitude, ') lng:', longitude, '(type:', typeof longitude, ')');
      
      const hasValidCoords = validateLatitude(latitude) && validateLongitude(longitude);
      
      if (!hasValidCoords) {
        console.log('Invalid/missing coordinates - updating heartbeat only. lat:', latitude, 'lng:', longitude);
        
        const { data: driver } = await supabaseAdmin
          .from('drivers')
          .select('admin_code')
          .eq('driver_id', driverId)
          .maybeSingle();
        
        if (driver) {
          await supabaseAdmin
            .from('drivers')
            .update({ 
              status: 'active', 
              last_seen_at: new Date().toISOString(),
              ...(batteryLevel !== undefined ? { device_info: { batteryLevel, lastUpdate: serverTime } } : {}),
            })
            .eq('driver_id', driverId);
        }
        
        return new Response(
          JSON.stringify({ 
            success: true, 
            stored: false, 
            warning: 'Invalid coordinates - heartbeat updated only',
            server_time: serverTime,
            nextUpdateMs: 15000,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!validateBatteryLevel(batteryLevel)) {
        return new Response(
          JSON.stringify({ error: 'Invalid battery level. Must be 0-100', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!validateSpeed(speed)) {
        return new Response(
          JSON.stringify({ error: 'Invalid speed. Must be 0-500 km/h', server_time: serverTime }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const accuracyValue = accuracyVal || 0;
      const isAccurate = accuracyValue <= 30;
      
      console.log('Location update - Driver:', driverId, 
        'Lat:', latitude, 'Lng:', longitude, 
        'Speed:', speed, 'Bearing:', bearing,
        'Accuracy:', accuracyValue, 'Accurate:', isAccurate,
        'Battery:', batteryLevel, 'Background:', isBackground);

      const { data: driver } = await supabaseAdmin
        .from('drivers')
        .select('admin_code, device_info')
        .eq('driver_id', driverId)
        .maybeSingle();

      if (!driver) {
        console.log('Driver not found for update-location:', driverId);
        return new Response(
          JSON.stringify({ error: 'Driver not found', requiresRelogin: true, server_time: serverTime }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const driverUpdate: any = { 
        status: 'active',
        last_seen_at: new Date().toISOString() 
      };
      
      if (batteryLevel !== undefined || bearing !== undefined) {
        driverUpdate.device_info = {
          ...(driver.device_info || {}),
          ...(batteryLevel !== undefined ? { batteryLevel } : {}),
          ...(bearing !== undefined ? { bearing } : {}),
          ...(isBackground !== undefined ? { isBackground } : {}),
          lastUpdate: serverTime,
        };
      }
      
      await supabaseAdmin
        .from('drivers')
        .update(driverUpdate)
        .eq('driver_id', driverId);

      // ALWAYS upsert driver_locations so driver appears on admin map (even with low accuracy)
      const { error: locationError } = await supabaseAdmin
        .from('driver_locations')
        .upsert({
          driver_id: driverId,
          admin_code: driver.admin_code,
          latitude,
          longitude,
          speed: speed || null,
          accuracy: accuracyValue,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'driver_id' });

      if (locationError) {
        console.error('Location update error:', locationError);
      }

      // Only store in history when accuracy is good (keeps trail data clean)
      if (isAccurate) {
        const { error: historyError } = await supabaseAdmin
          .from('driver_location_history')
          .insert({
            driver_id: driverId,
            admin_code: driver.admin_code,
            latitude,
            longitude,
            speed: speed || null,
            accuracy: accuracyValue,
            recorded_at: new Date().toISOString(),
          });

        if (historyError) {
          console.error('History insert error:', historyError);
        }
      } else {
        console.log('Stored approximate location (accuracy:', accuracyValue, 'm) - skipping history');
      }

      const nextUpdateMs = batteryLevel && batteryLevel < 20 ? 120000 : 
                           speed && speed > 5 ? 15000 : 60000;

      return new Response(
        JSON.stringify({ 
          success: true, 
          stored: true, 
          accuracy: accuracyValue,
          accurate: isAccurate,
          server_time: serverTime,
          nextUpdateMs
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action', server_time: serverTime }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Server error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message, server_time: new Date().toISOString() }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
