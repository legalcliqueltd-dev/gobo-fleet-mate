/**
 * Turn Supabase auth errors into something a fleet manager can act on.
 *
 * The raw strings were being rendered verbatim. "Invalid login credentials"
 * does not tell you which of the two fields was wrong, or that the account may
 * simply be unconfirmed; "User already registered" reads like a failure when
 * the useful next step is signing in. Each case below maps to the action the
 * person should take next, because that is the only thing an error on a login
 * form is for.
 *
 * Matching is on message text rather than a code because supabase-js does not
 * expose stable codes for most of these, so the strings are matched loosely
 * and anything unrecognised falls through unchanged rather than being
 * flattened into a useless generic.
 */
export function friendlyAuthError(err: unknown, context: 'login' | 'signup' | 'reset' | 'update'): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  const m = raw.toLowerCase();

  if (m.includes('invalid login credentials')) {
    return 'That email and password do not match. Check both, or reset your password.';
  }
  if (m.includes('email not confirmed')) {
    return 'Your email is not confirmed yet. Open the link we sent you, then sign in.';
  }
  if (m.includes('user already registered') || m.includes('already been registered')) {
    return 'An account already exists for this email. Sign in instead, or reset the password.';
  }
  if (m.includes('password should be at least') || m.includes('password is too short')) {
    return 'That password is too short — use at least 6 characters.';
  }
  if (m.includes('should be different from the old password')) {
    return 'That is your current password. Choose a different one.';
  }
  if (m.includes('email rate limit') || m.includes('over_email_send_rate_limit')) {
    return 'Too many emails requested. Wait a few minutes and try again.';
  }
  if (m.includes('rate limit') || m.includes('too many requests')) {
    return 'Too many attempts. Wait a moment and try again.';
  }
  if (m.includes('unable to validate email') || m.includes('invalid email')) {
    return 'That email address does not look right.';
  }
  if (m.includes('token has expired') || m.includes('invalid or has expired')) {
    return context === 'update'
      ? 'That reset link has expired. Request a new one.'
      : 'That link has expired. Request a new one.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'No connection. Check your network and try again.';
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return 'New accounts are currently disabled. Contact support.';
  }

  return raw || 'Something went wrong. Please try again.';
}
