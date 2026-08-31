import { useState } from 'react';
import { KeyRound, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import PasswordInput from '@/components/admin/PasswordInput';
import FormError from '@/components/admin/FormError';
import { useAuth } from '@/contexts/AuthContext';
import { changePassword, hasPasswordIdentity, signInProviders } from '@/services/accountSecurity';
import { friendlyAuthError } from '@/services/authErrors';

/**
 * Change your password without leaving the app.
 *
 * The only previous route was the forgot-password email — an inbox round trip
 * to change something you already know, and one that failed entirely whenever
 * the redirect URL was misconfigured.
 *
 * Accounts created through Google or Apple get an explanation instead of a
 * form: they have no password to change, and offering the form would let
 * `updateUser` quietly attach one, converting a social-only account into a
 * password account without the owner realising.
 */
export default function ChangePasswordSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canChange = hasPasswordIdentity(user);
  const providers = signInProviders(user);

  const handleSave = async () => {
    setError('');
    if (next !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    if (!user?.email) {
      setError('No email on this account.');
      return;
    }

    setSaving(true);
    try {
      await changePassword(user.email, current, next);
      toast.success('Password changed.');
      onClose();
    } catch (err) {
      setError(friendlyAuthError(err, 'update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <h2 className="font-heading text-base font-semibold">Change password</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {!canChange ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
              <KeyRound className="h-7 w-7 text-primary" />
            </span>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              You sign in with{' '}
              <span className="font-medium text-foreground">
                {providers.join(' and ') || 'a connected account'}
              </span>
              , so this account has no password to change. Manage it where you manage that account.
            </p>
            <Button className="h-12 w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="current-password">Current password</Label>
              <PasswordInput
                id="current-password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="The one you use now"
                className="h-12"
              />
            </div>

            <div className="mt-5 space-y-1.5">
              <Label htmlFor="new-password">New password</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 6 characters"
                className="h-12"
              />
            </div>

            <div className="mt-5 space-y-1.5">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <PasswordInput
                id="confirm-password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Type it again"
                className="h-12"
              />
            </div>

            <div className="mt-5">
              <FormError message={error} />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || !current || !next || !confirm}
              className="mt-4 h-12 w-full font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing…
                </>
              ) : (
                'Change password'
              )}
            </Button>

            <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
              We ask for your current password so that someone holding your unlocked phone cannot
              lock you out of your own fleet.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
