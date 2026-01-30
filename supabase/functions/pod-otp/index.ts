// Supabase Edge Function: pod-otp
// Generate and verify OTP codes for proof of delivery

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Generate a cryptographically secure random salt
function generateSalt(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Hash OTP with salt using SHA-256
async function hashOTP(otp: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - missing auth token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create client with user's token to validate
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = userData.user.id;

    // Service client for database operations
    const supabase = createClient(supabaseUrl, serviceKey);

    const { action, taskId, otp } = await req.json();

    // Verify user has access to this task
    const { data: task, error: taskAccessError } = await supabase
      .from('tasks')
      .select('id, assigned_user_id, created_by, otp_hash, otp_salt, otp_expires_at')
      .eq('id', taskId)
      .single();

    if (taskAccessError || !task) {
      return new Response(
        JSON.stringify({ error: 'Task not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has access (either assigned to task or created it)
    if (task.assigned_user_id !== userId && task.created_by !== userId) {
      return new Response(
        JSON.stringify({ error: 'Forbidden - no access to this task' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'generate') {
      // Generate a 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Generate unique random salt for this OTP
      const salt = generateSalt();
      
      // Hash the OTP with the unique salt
      const otpHash = await hashOTP(otpCode, salt);
      
      // Set expiry to 15 minutes from now
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // Update task with OTP hash, salt, and expiry
      const { error } = await supabase
        .from('tasks')
        .update({
          otp_hash: otpHash,
          otp_salt: salt,
          otp_expires_at: expiresAt,
        })
        .eq('id', taskId);

      if (error) throw error;

      console.log(`Generated OTP for task ${taskId} by user ${userId}`);

      return new Response(
        JSON.stringify({ success: true, otp: otpCode, expiresAt }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify') {
      // Check if OTP is expired
      if (task.otp_expires_at && new Date(task.otp_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ verified: false, message: 'OTP expired' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if OTP hash and salt exist
      if (!task.otp_hash || !task.otp_salt) {
        return new Response(
          JSON.stringify({ verified: false, message: 'No OTP generated for this task' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Hash the provided OTP with the stored salt
      const providedHash = await hashOTP(otp, task.otp_salt);

      // Compare hashes
      const verified = providedHash === task.otp_hash;

      console.log(`OTP verification for task ${taskId} by user ${userId}: ${verified}`);

      return new Response(
        JSON.stringify({ verified }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('OTP error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
