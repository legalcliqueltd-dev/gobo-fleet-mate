import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

/**
 * Changing your own password, from inside the app.
 *
 * Until now the only route was "forgot password" — an email round trip to
 * change something you already know. The website's Settings page went further
 * and told people to use the Supabase dashboard, which no customer can log
 * into.
 */

/**
 * Does this account actually have a password?
 *
 * Someone who signed up with Google or Apple has no email/password identity,
 * so offering them a "change password" form would be offering to change
 * something that does not exist — and `updateUser({ password })` would
 * silently create one, quietly turning a social-only account into a
 * password account without saying so.
 */
export function hasPasswordIdentity(user: User | null): boolean {
  if (!user) return false;
  const identities = user.identities ?? [];
  // An account with no identities array at all predates provider tracking;
  // treat it as an email account, which is what it will be.
  if (identities.length === 0) return true;
  return identities.some((i) => i.provider === 'email');
}

/** The providers this account can sign in with, for display. */
export function signInProviders(user: User | null): string[] {
  const identities = user?.identities ?? [];
  return identities
    .map((i) => i.provider)
    .filter((p) => p !== 'email')
    .map((p) => (p === 'google' ? 'Google' : p === 'apple' ? 'Apple' : p));
}

/**
 * Change the password, having first proved the current one.
 *
 * Supabase's `updateUser({ password })` does not ask for the existing
 * password — a live session is enough. That means anyone who picks up an
 * unlocked phone can change the password and lock the owner out of their own
 * fleet. Verifying first closes that, and costs one extra round trip.
 *
 * `signInWithPassword` is the verification: it returns an error for a wrong
 * password, and on success simply re-issues a session for the same user, so
 * there is no state to unwind.
 */
export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  if (newPassword.length < 6) {
    throw new Error('Your new password must be at least 6 characters.');
  }
  if (currentPassword === newPassword) {
    throw new Error('That is your current password. Choose a different one.');
  }

  const { error: verifyErr } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyErr) {
    throw new Error('Your current password is not right.');
  }

  const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
  if (updateErr) throw updateErr;
}
