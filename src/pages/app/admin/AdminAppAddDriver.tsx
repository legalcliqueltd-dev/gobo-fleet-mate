import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader2, MessageCircle, Share2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import FormError from '@/components/admin/FormError';
import { useEntitlements } from '@/hooks/useEntitlements';

/**
 * Create a connection code from the phone.
 *
 * Mirrors the website's Add Device flow exactly — `generate_connection_code`
 * then a `devices` row — so a code minted here is indistinguishable from one
 * made on the desktop dashboard, and the driver joins with it the same way.
 *
 * The share text deliberately carries only the code and the app name. The
 * website's ShareCodeButton embeds an APK download link, which would trip
 * `verify-native-bundle.sh` (no store or sideload CTAs may reach the native
 * bundle — App Store guideline 3.1.3(f)), so this screen has its own.
 */
export default function AdminAppAddDriver() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { driverLimit, isPro } = useEntitlements();
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteText = code
    ? `You have been added to ${name.trim() || 'the fleet'} on FleetTrackMate.\n\nYour connection code is: ${code}\n\nOpen FleetTrackMate, choose "I drive", and enter this code with your name.`
    : '';

  // How many codes already exist, so the plan's cap can be enforced here as
  // well as on the website — a limit enforced in only one place is not a limit.
  useEffect(() => {
    if (!user) return;
    void supabase
      .from('devices')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setDeviceCount(count ?? 0));
  }, [user]);

  const atLimit = deviceCount != null && deviceCount >= driverLimit;

  const create = async () => {
    setError('');
    if (!name.trim()) return setError('Give the driver or vehicle a name.');
    if (!user) return setError('You are not signed in.');
    if (atLimit) {
      // States the limit and stops. Naming where to go and pay would be a
      // call to action for purchase outside the app (guideline 3.1.3(f)).
      return setError(
        `Your plan covers up to ${driverLimit} drivers. Remove one to add another.`
      );
    }

    setCreating(true);
    try {
      const { data: generated, error: codeError } = await supabase.rpc('generate_connection_code');
      if (codeError || !generated) throw codeError ?? new Error('Could not generate a code.');

      const { data, error: insertError } = await supabase
        .from('devices')
        .insert([
          {
            user_id: user.id,
            name: name.trim(),
            status: 'offline',
            connection_code: generated as string,
          },
        ])
        .select()
        .single();

      if (insertError) throw insertError;

      setCode(data.connection_code);
      toast.success('Code created — share it with your driver');
    } catch (err) {
      console.error('[AdminAppAddDriver] create failed:', err);
      setError(err instanceof Error ? err.message : 'Could not create the code.');
    } finally {
      setCreating(false);
    }
  };

  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Code copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy the code');
    }
  };

  const share = async () => {
    // Native share sheet first — it reaches WhatsApp, SMS and mail at once.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'FleetTrackMate', text: inviteText });
        return;
      } catch {
        return; // user dismissed the sheet
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(inviteText)}`, '_blank');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-5">
        <button
          type="button"
          onClick={() => navigate('/app/admin/fleet')}
          className="mb-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Fleet
        </button>

        {!code ? (
          <>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent">
                <UserPlus className="h-5 w-5 text-primary" />
              </span>
              <div>
                <h2 className="font-heading text-lg font-bold">Add a driver</h2>
                <p className="text-xs text-muted-foreground">
                  Creates a connection code they enter in the app
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="driver-name">Driver or vehicle name</Label>
              <Input
                id="driver-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Truck 3 — Ade"
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                Only you see this. It labels the vehicle on your map.
              </p>
              {deviceCount != null && !isPro && (
                <p className="telemetry text-xs text-muted-foreground">
                  {deviceCount} of {driverLimit} drivers used
                </p>
              )}
            </div>

            <div className="mt-4">
              <FormError message={error} />
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mb-2 flex items-center justify-center gap-2 text-success">
              <Check className="h-5 w-5" />
              <p className="text-sm font-semibold">Code ready for {name.trim()}</p>
            </div>

            {/* The code is the whole point of this screen, so it gets the room. */}
            <div
              className="my-5 rounded-2xl border-2 border-primary/30 bg-accent px-4 py-7"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
                Connection code
              </p>
              <p className="telemetry mt-3 text-4xl font-bold tracking-[0.35em] text-foreground">
                {code}
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="h-12 flex-1 gap-2" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button className="h-12 flex-1 gap-2" onClick={share}>
                {typeof navigator !== 'undefined' && navigator.share ? (
                  <Share2 className="h-4 w-4" />
                ) : (
                  <MessageCircle className="h-4 w-4" />
                )}
                Share
              </Button>
            </div>

            <p className="mt-5 text-left text-sm leading-relaxed text-muted-foreground">
              Ask the driver to open FleetTrackMate, choose <strong>I drive</strong>, and enter
              this code with their name. They will appear on your fleet map as soon as they go on
              duty.
            </p>
          </div>
        )}
      </div>

      <div
        className="border-t border-border bg-background px-4 py-3"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}
      >
        {!code ? (
          <Button
            className="h-12 w-full font-semibold"
            disabled={creating || atLimit}
            onClick={create}
          >
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              'Create connection code'
            )}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-12 flex-1"
              onClick={() => {
                setCode(null);
                setName('');
              }}
            >
              Add another
            </Button>
            <Button className="h-12 flex-1" onClick={() => navigate('/app/admin/fleet')}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
