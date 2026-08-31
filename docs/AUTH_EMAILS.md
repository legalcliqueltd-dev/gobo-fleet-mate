# Auth emails: why they say Supabase, and how to fix it

## The problem

There are two email systems in this project, and only one of them is yours.

**Your emails** — trial reminders, invoices, bulk sends, SOS dispatch, geofence
alerts — go through **Resend**, from `FleetTrackMate <noreply@fleettrackmate.com>`.
See `supabase/functions/bulk-email/index.ts`.

**Auth emails** — password reset, signup confirmation, email change — are not
sent by your code at all. When the app calls `supabase.auth.resetPasswordForEmail()`,
Supabase's own GoTrue service composes and sends that message server-side. It
never reaches Resend. So it uses Supabase's defaults: their sender address and
their unbranded templates.

That is why the reset email says Supabase. It is not a bug in the app.

## The part that actually breaks things

Supabase's built-in SMTP is **not a production email service**. It is heavily
rate-limited and documented as being for development only. Password reset
emails that never arrive are the expected behaviour of that service under any
real load — which matches the "forgot password does not really work well"
report.

Fixing the branding and fixing the deliverability are the same job: point
Supabase Auth at Resend, which you already pay for and have a verified domain
on.

---

## Fix 1 — Custom SMTP (do this first; it is the one that matters)

**Dashboard → Project Settings → Authentication → SMTP Settings** → enable
custom SMTP:

| Field | Value |
| --- | --- |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | your Resend API key (the same `RESEND_API_KEY` the edge functions use) |
| Sender email | `noreply@fleettrackmate.com` |
| Sender name | `FleetTrackMate` |

`fleettrackmate.com` is already verified in Resend — the edge functions send
from it — so there is no DNS work to redo.

While you are on that screen, raise the auth rate limits (Authentication →
Rate Limits). The defaults are tuned for Supabase's shared SMTP, not Resend's.

---

## Fix 2 — Templates

**Dashboard → Authentication → Email Templates.** Each one below matches the
`emailTemplate()` shell in `bulk-email/index.ts`, so auth mail looks like the
rest of your mail.

Supabase substitutes `{{ .ConfirmationURL }}` server-side. Leave those tokens
exactly as written.

### Confirm signup

Subject: `Confirm your FleetTrackMate account`

```html
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;">FleetTrackMate</h1></div><div style="padding:24px;"><h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Confirm your account</h2><div style="color:#475569;font-size:14px;line-height:1.6;"><p>Tap the button below to activate your FleetTrackMate account and start tracking your fleet.</p></div><div style="text-align:center;margin:24px 0;"><a href="{{ .ConfirmationURL }}" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Confirm my account</a></div><p style="color:#94a3b8;font-size:12px;line-height:1.6;">If you did not create a FleetTrackMate account, ignore this email — nothing will happen.</p></div><div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because someone signed up with this address.</p></div></div></div></body></html>
```

### Reset password

Subject: `Reset your FleetTrackMate password`

```html
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;">FleetTrackMate</h1></div><div style="padding:24px;"><h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Set a new password</h2><div style="color:#475569;font-size:14px;line-height:1.6;"><p>You asked to reset the password for this account. Tap below to choose a new one. The link expires in one hour.</p></div><div style="text-align:center;margin:24px 0;"><a href="{{ .ConfirmationURL }}" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Choose a new password</a></div><p style="color:#94a3b8;font-size:12px;line-height:1.6;">If you did not ask for this, ignore this email — your password stays as it is.</p></div><div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because you have a FleetTrackMate account.</p></div></div></div></body></html>
```

### Change email address

Subject: `Confirm your new FleetTrackMate email`

```html
<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:24px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);"><div style="background:#1e293b;padding:20px 24px;"><h1 style="margin:0;color:#fff;font-size:18px;">FleetTrackMate</h1></div><div style="padding:24px;"><h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Confirm your new address</h2><div style="color:#475569;font-size:14px;line-height:1.6;"><p>Confirm this address to finish moving your FleetTrackMate sign-in to <strong>{{ .NewEmail }}</strong>.</p></div><div style="text-align:center;margin:24px 0;"><a href="{{ .ConfirmationURL }}" style="background-color:#2563eb;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;display:inline-block;">Confirm this address</a></div></div><div style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">You're receiving this because you have a FleetTrackMate account.</p></div></div></div></body></html>
```

---

## Do not forget the redirect URL

None of the above helps if the link has nowhere to land. **Authentication →
URL Configuration → Redirect URLs** must include:

```
fleettrackmate://auth/callback
```

Without it the emailed link cannot return to the native app, no matter how
good the email looks. The app-side screens for this already exist
(`AdminUpdatePassword` on native, `UpdatePassword` on web).
