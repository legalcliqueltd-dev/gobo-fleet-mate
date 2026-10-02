import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Camera, CheckCircle2, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type View = {
  status: 'issued' | 'viewed' | 'redeemed' | 'rejected' | 'refused' | 'expired';
  customerName: string | null;
  what: string | null;
  expiresAt: string;
};

const REASONS = [
  'Wrong item',
  'Damaged or leaking',
  'Something is missing',
  'I did not order this',
  'The driver is pressuring me',
];

function expiresIn(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `Expires in ${h}h ${m}m` : `Expires in ${m}m`;
}

/**
 * The page a delivery customer lands on. Public, token in the URL, no login
 * and nothing to install.
 *
 * This is the only screen in the product whose reader has never seen
 * FleetTrackMate and cannot be trained, so it carries one instruction and two
 * choices and nothing else. An earlier draft had a four-step numbered
 * explainer; it was cut because nobody standing at their door with a driver
 * waiting reads four steps.
 *
 * NOTE ON THE CODE ITSELF: it is not shown here, and cannot be. Codes are
 * stored as a salted hash and never in plaintext, so no screen and no database
 * dump can reveal one — including to the business owner, which is the point
 * (spec §2.J). The code travels in the customer's email or SMS; this page is
 * where they act on it.
 */
export default function DeliveryCode() {
  const { token } = useParams<{ token: string }>();
  const [view, setView] = useState<View | null>(null);
  const [loading, setLoading] = useState(true);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await supabase.functions.invoke('delivery-code', {
        body: { action: 'customer-view', token },
      });
      if (data?.success) setView(data as View);
    } catch (err) {
      console.error('[DeliveryCode] load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const addPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || photos.length >= 3) return;
    const reader = new FileReader();
    reader.onload = () => setPhotos((p) => [...p, String(reader.result)]);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const submitReport = async () => {
    setSending(true);
    try {
      await supabase.functions.invoke('delivery-code', {
        body: { action: 'reject', token, reason, photos },
      });
      setSent(true);
    } catch (err) {
      console.error('[DeliveryCode] report failed:', err);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!view) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-background px-8 text-center">
        <p className="font-heading text-lg font-bold">This link is not valid</p>
        <p className="text-sm text-muted-foreground">
          Check the message you were sent, or ask the business to send it again.
        </p>
      </div>
    );
  }

  if (sent || view.status === 'rejected') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" />
        <p className="font-heading text-lg font-bold">Reported</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          The business has been told. Do not give the driver your code — he
          should take the item back.
        </p>
      </div>
    );
  }

  if (view.status === 'redeemed') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-8 text-center">
        <CheckCircle2 className="h-10 w-10 text-success" />
        <p className="font-heading text-lg font-bold">Delivery confirmed</p>
        <p className="text-sm text-muted-foreground">This code has been used.</p>
      </div>
    );
  }

  if (view.status === 'expired') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-8 text-center">
        <AlertTriangle className="h-10 w-10 text-warning" />
        <p className="font-heading text-lg font-bold">This code has expired</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Contact the business and ask them to send you a new one.
        </p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="mx-auto max-w-md px-6 pt-10">
        {view.what && (
          <p className="text-sm text-muted-foreground">{view.what}</p>
        )}

        <h1 className="mt-2 font-heading text-2xl font-bold leading-snug tracking-tight">
          Check your item first, then give the driver your code.
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your code is in the message we sent you. Open the item and check it
          while the driver is still there. Once you give the code, the delivery
          is confirmed and cannot be undone.
        </p>

        <p className="mt-4 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {expiresIn(view.expiresAt)}
        </p>

        {!reporting ? (
          <button
            type="button"
            onClick={() => setReporting(true)}
            className="mt-8 flex w-full items-center justify-between gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-4 text-left"
          >
            <span>
              <span className="block text-sm font-semibold text-destructive">
                Something is wrong with it
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Keep your code and tell the business instead
              </span>
            </span>
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
          </button>
        ) : (
          <div className="mt-8 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-heading text-base font-semibold">What is wrong?</p>
              <button
                type="button"
                onClick={() => setReporting(false)}
                aria-label="Cancel"
                className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1.5">
              {REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`flex min-h-[44px] w-full items-center rounded-xl border px-3 text-left text-sm transition-colors ${
                    reason === r
                      ? 'border-primary bg-accent font-medium'
                      : 'border-border bg-background'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            {photos.length > 0 && (
              <div className="mt-3 flex gap-2">
                {photos.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-border object-cover"
                  />
                ))}
              </div>
            )}

            {photos.length < 3 && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={addPhoto}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm text-muted-foreground"
                >
                  <Camera className="h-4 w-4" />
                  {photos.length === 0 ? 'Take a photo of the problem' : 'Add another photo'}
                </button>
              </>
            )}

            <button
              type="button"
              disabled={!reason || sending}
              onClick={submitReport}
              className="mt-4 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-destructive text-sm font-semibold text-destructive-foreground disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send this report'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
