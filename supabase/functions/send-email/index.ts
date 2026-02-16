// Centralized email sender using Resend API
// Called directly by other edge functions or as a standalone function

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = 'FleetTrackMate <noreply@fleettrackmate.com>';

export async function sendEmail({ to, subject, html, replyTo }: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const payload: any = {
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    };
    if (replyTo) payload.reply_to = replyTo;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...payload, headers: { 'List-Unsubscribe': '<https://fleettrackmate.com/settings>' } }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', res.status, data);
      return { success: false, error: data.message || 'Failed to send email' };
    }

    console.log('Email sent successfully:', data.id, 'to:', to);
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('Email send error:', err);
    return { success: false, error: err.message };
  }
}

// HTML email wrapper template
export function emailTemplate(title: string, bodyContent: string, actionUrl?: string, actionLabel?: string): string {
  const actionButton = actionUrl && actionLabel ? `
    <div style="text-align:center;margin:24px 0;">
      <a href="${actionUrl}" style="background-color:#2563eb;color:#ffffff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">${actionLabel}</a>
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:24px;">
    <div style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <div style="background:#1e293b;padding:20px 24px;">
        <h1 style="margin:0;color:#ffffff;font-size:18px;font-weight:700;">🚛 FleetTrackMate</h1>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">${title}</h2>
        <div style="color:#475569;font-size:14px;line-height:1.6;">
          ${bodyContent}
        </div>
        ${actionButton}
      </div>
      <div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because you have an account on FleetTrackMate. If this wasn't expected, you can safely ignore this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Standalone endpoint for testing
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();
    
    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: 'to, subject, and html are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await sendEmail({ to, subject, html });
    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
