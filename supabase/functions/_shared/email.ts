/**
 * TrackMate email — one layout for every message the platform sends.
 *
 * Built the way email has to be: tables, inline styles, a bulletproof button,
 * no web fonts (Helvetica Neue is the brand face and falls back to Helvetica
 * and Arial, which every client has), no SVG (Gmail strips it — the mark is a
 * PNG served from the website), and no gradients (brand rule).
 *
 *   ┌──────────────────────────────┐
 *   │ [mark] TrackMate        navy │  header
 *   ├──────────────────────────────┤  4px accent bar (neon / amber / red)
 *   │ EYEBROW                      │
 *   │ Title                        │  white card
 *   │ body…                        │
 *   │ [ Neon button ]              │
 *   └──────────────────────────────┘
 *     footer: links, why you got it
 *
 * The functions used to carry a dozen hand-copied templates in the old slate
 * and blue. Each now passes its content here; bodies that still contain the
 * old inline colours are mapped onto the brand palette by `rebrand()`.
 */

export const FROM_EMAIL = 'TrackMate <noreply@fleettrackmate.com>';
export const APP_URL = 'https://fleettrackmate.com';
const MARK_URL = `${APP_URL}/email/trackmate-mark.png`;
const APP_STORE_URL = 'https://apps.apple.com/us/app/fleettrackmate-driver/id6761863956';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.fleettrackmate.driver';

const NAVY = '#000738';
const NEON = '#00ff39';
const AMBER = '#ffbf0b';
const SOS_RED = '#d6332a';
const INK = '#000738';
const BODY_TEXT = '#3d4466';
const MUTED = '#7a8099';
const PAPER = '#f4f4f4';
const RULE = '#e4e6ee';
const FONT = "'Helvetica Neue',Helvetica,Arial,sans-serif";

export type EmailTone = 'info' | 'success' | 'warning' | 'sos';

const ACCENT: Record<EmailTone, string> = {
  info: NEON,
  success: NEON,
  warning: AMBER,
  sos: SOS_RED,
};

const EYEBROW_COLOR: Record<EmailTone, string> = {
  info: '#4a5072',
  success: '#0a8a2a',
  warning: '#9a6b00',
  sos: SOS_RED,
};

/**
 * Old template colours → brand. Applied to every body so content written for
 * the previous slate/blue templates lands on-palette without rewriting each
 * message by hand.
 */
const LEGACY_COLORS: [RegExp, string][] = [
  [/#1e293b|#0f172a|#101628|#374151/gi, INK],
  [/#475569|#5e6779/gi, BODY_TEXT],
  [/#64748b|#94a3b8|#9aa3b2/gi, MUTED],
  [/#2563eb|#3b82f6|#1e40af|#0b59d5/gi, NAVY],
  [/#22c55e|#16a34a|#166534|#128640/gi, '#0a8a2a'],
  [/#f0fdf4|#dcfce7/gi, '#f1fbf3'],
  [/#bbf7d0/gi, '#bfe9c9'],
  [/#eff6ff|#eef3fd|#f8fafc|#f4f6fa|#eef1f6/gi, '#f5f6fa'],
  [/#bfdbfe|#e2e8f0|#e3e8f0/gi, RULE],
  [/#f4f4f5/gi, PAPER],
  [/#f59e0b/gi, AMBER],
  [/#fef2f2/gi, '#fff3f2'],
  [/#fecaca/gi, '#f6c9c5'],
  [/#dc2626|#991b1b/gi, SOS_RED],
  [/-apple-system,\s*BlinkMacSystemFont,\s*'Segoe UI',\s*Roboto,\s*sans-serif/gi, FONT],
  [/FleetTrackMate/g, 'TrackMate'],
  [/🚛\s*/g, ''],
];

export function rebrand(html: string): string {
  return LEGACY_COLORS.reduce((out, [pattern, to]) => out.replace(pattern, to), html);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A solid neon button that survives Outlook (table + padded link). */
export function button(url: string, label: string, tone: EmailTone = 'info'): string {
  const bg = tone === 'sos' ? SOS_RED : NEON;
  const fg = tone === 'sos' ? '#ffffff' : NAVY;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 4px;"><tr><td bgcolor="${bg}" style="border-radius:10px;background:${bg};">
<a href="${url}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:700;color:${fg};text-decoration:none;border-radius:10px;">${label}</a>
</td></tr></table>`;
}

/** Label / value rows in a quiet panel — receipts, alerts, details. */
export function details(rows: [string, string][], highlightLast = false): string {
  const cells = rows
    .map(([label, value], i) => {
      const last = highlightLast && i === rows.length - 1;
      return `<tr>
<td style="padding:9px 0;font-family:${FONT};font-size:13px;color:${MUTED};${i ? `border-top:1px solid ${RULE};` : ''}">${label}</td>
<td align="right" style="padding:9px 0;font-family:${FONT};font-size:14px;font-weight:700;color:${last ? '#0a8a2a' : INK};${i ? `border-top:1px solid ${RULE};` : ''}">${value}</td>
</tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;background:#f5f6fa;border-radius:12px;"><tr><td style="padding:6px 18px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}</table>
</td></tr></table>`;
}

/** A short highlighted note with a coloured edge. */
export function callout(html: string, tone: EmailTone = 'info'): string {
  const edge = ACCENT[tone];
  const bg = tone === 'sos' ? '#fff3f2' : tone === 'warning' ? '#fff8e6' : '#f1fbf3';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0;"><tr>
<td width="4" style="background:${edge};border-radius:4px 0 0 4px;"></td>
<td style="background:${bg};padding:14px 16px;border-radius:0 10px 10px 0;font-family:${FONT};font-size:14px;line-height:1.55;color:${INK};">${html}</td>
</tr></table>`;
}

export type BrandEmail = {
  title: string;
  /** Body HTML. Paragraphs, details(), callout() — legacy markup is fine too. */
  body: string;
  /** Small label above the title: "Payment", "SOS alert", "Driver update". */
  eyebrow?: string;
  tone?: EmailTone;
  cta?: { url: string; label: string };
  /** The grey line most inboxes show after the subject. */
  preheader?: string;
  /** Why this person got the email. */
  reason?: string;
};

export function brandEmail({
  title,
  body,
  eyebrow,
  tone = 'info',
  cta,
  preheader,
  reason = "You're receiving this because you have a TrackMate account.",
}: BrandEmail): string {
  const accent = ACCENT[tone];
  const pre = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}&#8203;&#8203;&#8203;&#8203;&#8203;&#8203;</div>`
    : '';
  const eyebrowHtml = eyebrow
    ? `<p style="margin:0 0 10px;font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${EYEBROW_COLOR[tone]};">${eyebrow}</p>`
    : '';
  const ctaHtml = cta ? button(cta.url, cta.label, tone) : '';

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${PAPER};-webkit-text-size-adjust:100%;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAPER};"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

<tr><td style="background:${NAVY};border-radius:16px 16px 0 0;padding:20px 28px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="padding-right:12px;"><img src="${MARK_URL}" width="36" height="36" alt="" style="display:block;border:0;border-radius:9px;"></td>
<td style="font-family:${FONT};font-size:22px;color:#ffffff;letter-spacing:-0.3px;"><span style="font-weight:800;">Track</span><span style="font-weight:400;">Mate</span></td>
</tr></table>
</td></tr>
<tr><td style="background:${accent};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>

<tr><td style="background:#ffffff;border-radius:0 0 16px 16px;padding:34px 28px 32px;">
${eyebrowHtml}
<h1 style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.2;font-weight:800;letter-spacing:-0.4px;color:${INK};">${title}</h1>
<div style="font-family:${FONT};font-size:15px;line-height:1.65;color:${BODY_TEXT};">${rebrand(body)}</div>
${ctaHtml}
</td></tr>

<tr><td style="padding:24px 28px 8px;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED};text-align:center;">
<a href="${APP_URL}" style="color:${INK};font-weight:700;text-decoration:none;">fleettrackmate.com</a>
&nbsp;·&nbsp;<a href="${APP_STORE_URL}" style="color:${MUTED};text-decoration:none;">App Store</a>
&nbsp;·&nbsp;<a href="${PLAY_STORE_URL}" style="color:${MUTED};text-decoration:none;">Google Play</a>
<br>${reason}
</td></tr>

</table>
</td></tr></table>
</body></html>`;
}

// ── Templates by message type ──────────────────────────────────────────

/** Tone and eyebrow from a message's title, for the generic senders. */
function infer(title: string): { tone: EmailTone; eyebrow?: string } {
  if (/\bSOS\b|emergency/i.test(title)) return { tone: 'sos', eyebrow: 'SOS alert' };
  if (/disabled|inactive|offline|not reporting|left|exit|expir|ending|ends|overdue|failed|cancel/i.test(title)) {
    return { tone: 'warning', eyebrow: 'Heads up' };
  }
  if (/confirm|complete|welcome|connected|activated|started|arrived|delivered|invoice|receipt/i.test(title)) {
    return { tone: 'success' };
  }
  return { tone: 'info' };
}

/** The old `emailTemplate(title, body, url, label)` signature, rebranded. */
export function legacyEmail(title: string, body: string, actionUrl?: string, actionLabel?: string): string {
  const { tone, eyebrow } = infer(title);
  return brandEmail({
    title,
    body,
    tone,
    eyebrow,
    cta: actionUrl && actionLabel ? { url: actionUrl, label: actionLabel } : undefined,
    preheader: title,
  });
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function paymentConfirmedEmail(o: {
  plan: string;
  amount: string;
  provider: string;
  renewalDate: string;
  daysRemaining: number;
}): string {
  return brandEmail({
    eyebrow: 'Payment received',
    tone: 'success',
    title: 'You’re all set.',
    preheader: `Your TrackMate ${cap(o.plan)} plan is active until ${o.renewalDate}.`,
    body: `<p style="margin:0;">Your subscription is active and every ${cap(o.plan)} feature is unlocked.</p>
${details([
  ['Plan', cap(o.plan)],
  ['Amount', o.amount],
  ['Paid with', cap(o.provider)],
  ['Next renewal', o.renewalDate],
  ['Days remaining', `${o.daysRemaining} days`],
], true)}`,
    cta: { url: `${APP_URL}/dashboard`, label: 'Open your dashboard' },
    reason: 'A receipt for your TrackMate subscription. Manage it any time from Settings.',
  });
}

export function trialStartedEmail(o: { plan: string; trialEndDate: string; chargeDate: string; amount: string }): string {
  return brandEmail({
    eyebrow: 'Free trial',
    tone: 'success',
    title: 'Your 7 days start now.',
    preheader: `Full ${cap(o.plan)} access until ${o.trialEndDate}. No charge until then.`,
    body: `<p style="margin:0;">Welcome to TrackMate. You have full access to every ${cap(o.plan)} feature while you try it.</p>
${details([
  ['Plan', cap(o.plan)],
  ['Trial ends', o.trialEndDate],
  ['First charge', `${o.amount} on ${o.chargeDate}`],
])}
${callout('You won’t be charged until the trial ends, and you can cancel any time from Settings.')}`,
    cta: { url: `${APP_URL}/dashboard`, label: 'Open your dashboard' },
    reason: 'Sent because you started a TrackMate trial.',
  });
}

export function invoiceEmail(o: {
  name: string;
  plan: string;
  amount: string;
  provider: string;
  renewalDate: string;
  daysRemaining: number;
  invoiceDate: string;
}): string {
  return brandEmail({
    eyebrow: 'Invoice',
    tone: 'success',
    title: `Thanks, ${o.name}.`,
    preheader: `Your TrackMate invoice — ${o.amount}, ${o.plan}.`,
    body: `<p style="margin:0;">Here is your subscription invoice.</p>
${details([
  ['Invoice date', o.invoiceDate],
  ['Plan', o.plan],
  ['Amount', o.amount],
  ['Paid with', o.provider],
  ['Status', '<span style="color:#0a8a2a;">Paid</span>'],
])}
${details([
  ['Next renewal', o.renewalDate],
  ['Days remaining', `${o.daysRemaining} days`],
], true)}`,
    cta: { url: `${APP_URL}/settings`, label: 'Manage subscription' },
    reason: 'An automated invoice from TrackMate. No action is needed.',
  });
}

/**
 * Sent to a delivery's CUSTOMER — someone who has never heard of TrackMate.
 * It has one job: the code, legible at the door. So the code is the hero.
 */
export function deliveryCodeEmail(o: { business: string; code: string; link: string; what: string | null }): string {
  return brandEmail({
    eyebrow: `Delivery from ${o.business}`,
    tone: 'info',
    title: 'Check your item first, then give the driver this code.',
    preheader: 'Check your item first, then give the driver your code.',
    body: `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 18px;"><tr>
<td align="center" bgcolor="${NAVY}" style="background:${NAVY};border-radius:14px;padding:26px 12px;font-family:${FONT};font-size:44px;line-height:1;font-weight:800;letter-spacing:10px;color:${NEON};">${o.code}</td>
</tr></table>
${o.what ? `<p style="margin:0 0 12px;">Delivery: <strong style="color:${INK};">${o.what}</strong></p>` : ''}
${callout('Only give this code once you have opened and checked your item, with the driver still there. Giving it confirms the delivery and cannot be undone.', 'warning')}`,
    cta: { url: o.link, label: 'Something wrong? Report it' },
    reason: `You received this because ${o.business} is sending you a delivery. Never share this code with anyone except the person handing you the item.`,
  });
}
