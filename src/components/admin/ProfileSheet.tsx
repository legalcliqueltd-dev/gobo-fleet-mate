import { useEffect, useState } from 'react';
import { Loader2, Phone, ShieldAlert, UserRound, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormError from '@/components/admin/FormError';
import AvatarPicker from '@/components/admin/AvatarPicker';
import { useAuth } from '@/contexts/AuthContext';
import {
  clearAdminContact,
  fetchAdminContact,
  saveAdminContact,
  updateDisplayName,
} from '@/services/adminProfile';

/**
 * Edit who you are, and the number your drivers ring.
 *
 * Both were previously write-once: the name was captured on the signup form
 * and never again, and the emergency number lived only in the website's
 * Settings page. That is the wrong home for it — the number a driver dials in
 * an emergency is precisely what changes while you are away from a desk, and
 * a stale one is worse than none because it will be trusted.
 *
 * Email is shown but not editable. Changing it means re-verification and
 * re-linking any Google / Apple identity attached to it, which is a different
 * and much larger job than this screen.
 */
export default function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hasContact, setHasContact] = useState(false);
  const [noCodes, setNoCodes] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    setName(((user.user_metadata?.full_name as string | undefined) ?? '').trim());
    setAvatarUrl((user.user_metadata?.avatar_url as string | undefined) ?? null);

    fetchAdminContact(user.id)
      .then(({ contact, codes }) => {
        if (cancelled) return;
        setNoCodes(codes.length === 0);
        if (contact) {
          setHasContact(true);
          setContactName(contact.name);
          setPhone(contact.phone);
        }
      })
      .catch((err) => {
        if (!cancelled) console.warn('[ProfileSheet] could not load contact:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setError('');
    setSaving(true);
    try {
      await updateDisplayName(user.id, name);

      // The contact is optional — saving the sheet with an empty number is a
      // valid way to say "I have not set one yet", not an error worth blocking
      // the name change for.
      if (phone.trim()) {
        const codes = await saveAdminContact(user.id, { name: contactName || name, phone });
        toast.success(
          codes === 1
            ? 'Saved. Your drivers see the new number.'
            : `Saved. Updated across ${codes} connection codes.`
        );
      } else {
        if (hasContact) await clearAdminContact(user.id);
        toast.success('Profile saved.');
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-4 py-3.5">
        <h2 className="font-heading text-base font-semibold">Your profile</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted"
        >
          <X className="h-5 w-5" />
        </button>
      </header>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-5">
          {user && (
            <div className="mb-6">
              <AvatarPicker
                userId={user.id}
                currentUrl={avatarUrl}
                displayName={name || user.email || '?'}
                onChange={setAvatarUrl}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Your name</Label>
            <div className="relative">
              <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoCapitalize="words"
                placeholder="Ada Okafor"
                className="h-12 pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Shown on your dashboard and on the reports you send.
            </p>
          </div>

          <div className="mt-5 space-y-1.5">
            <Label>Email</Label>
            <div className="flex h-12 items-center rounded-md border border-border bg-muted px-3 text-sm text-muted-foreground">
              {user?.email ?? '—'}
            </div>
            <p className="text-xs text-muted-foreground">
              Your sign-in address. Contact support to change it.
            </p>
          </div>

          <div className="mt-7 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm font-semibold">Emergency contact</p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              The number on your drivers' SOS screen. They tap it to call you when something goes
              wrong, so keep it current.
            </p>

            {noCodes ? (
              <p className="mt-3 rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                Add a driver first — the contact attaches to your connection code.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="contact-name">Name drivers see</Label>
                  <Input
                    id="contact-name"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={name || 'Fleet Administrator'}
                    className="h-12"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="contact-phone">Phone number</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="contact-phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+234 800 000 0000"
                      className="h-12 pl-10"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to show "not set" instead of a number they cannot reach.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5">
            <FormError message={error} />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="mt-4 h-12 w-full font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              'Save changes'
            )}
          </Button>

          <div className="h-8" />
        </div>
      )}
    </div>
  );
}
