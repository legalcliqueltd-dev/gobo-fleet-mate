// Supabase Edge Function: pod-otp
// Generate and verify OTP codes for proof of delivery

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, serviceKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, taskId, otp } = await req.json();

    if (action === 'generate') {
      // Generate a 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Hash the OTP (simple sha256)
      const encoder = new TextEncoder();
      const data = encoder.encode(otpCode + 'salt'); // In production, use proper salt
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const otpHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Set expiry to 15 minutes from now
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

      // Update task with OTP hash and expiry
      const { error } = await supabase
        .from('tasks')
        .update({
          otp_hash: otpHash,
          otp_expires_at: expiresAt,
        })
        .eq('id', taskId);

      if (error) throw error;

      console.log(`Generated OTP for task ${taskId}: ${otpCode}`);

      return new Response(
        JSON.stringify({ success: true, otp: otpCode, expiresAt }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (action === 'verify') {
      // Fetch task
      const { data: task, error: taskError } = await supabase
        .from('tasks')
        .select('otp_hash, otp_expires_at')
        .eq('id', taskId)
        .single();

      if (taskError || !task) {
        throw new Error('Task not found');
      }

      // Check if OTP is expired
      if (task.otp_expires_at && new Date(task.otp_expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ verified: false, message: 'OTP expired' }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Hash the provided OTP
      const encoder = new TextEncoder();
      const data = encoder.encode(otp + 'salt');
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const providedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      // Compare hashes
      const verified = providedHash === task.otp_hash;

      console.log(`OTP verification for task ${taskId}: ${verified}`);

      return new Response(
        JSON.stringify({ verified }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('OTP error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
