import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { signInWithProvider, type SocialProvider } from '@/services/adminAuth';

function GoogleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AppleGlyph() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 12.54c-.03-2.7 2.2-4 2.3-4.06-1.25-1.83-3.2-2.08-3.89-2.11-1.65-.17-3.23.97-4.07.97-.84 0-2.13-.95-3.5-.92-1.8.03-3.46 1.05-4.39 2.66-1.87 3.25-.48 8.06 1.34 10.7.89 1.29 1.95 2.74 3.34 2.69 1.34-.05 1.85-.87 3.47-.87 1.62 0 2.08.87 3.5.84 1.44-.02 2.36-1.31 3.24-2.61 1.02-1.5 1.44-2.95 1.46-3.02-.03-.01-2.8-1.07-2.83-4.26M14.4 4.6c.74-.9 1.24-2.14 1.1-3.38-1.07.04-2.36.71-3.12 1.6-.68.79-1.28 2.06-1.12 3.27 1.19.09 2.4-.6 3.14-1.49" />
    </svg>
  );
}

/**
 * Sign in with Apple is deferred — the credentials have not been provisioned
 * yet. The code path in `adminAuth` is complete, so re-enabling it is a matter
 * of flipping this flag once the Apple Services ID exists.
 *
 * MUST be turned back on before any iOS App Store submission: offering Google
 * sign-in without Apple sign-in is an automatic rejection under App Store
 * guideline 4.8. Android has no such requirement, which is why shipping
 * Google-only is fine for the Play release.
 */
const ENABLE_APPLE_SIGN_IN = false;

const PROVIDERS: { id: SocialProvider; label: string; Glyph: () => JSX.Element }[] = [
  { id: 'google', label: 'Continue with Google', Glyph: GoogleGlyph },
  ...(ENABLE_APPLE_SIGN_IN
    ? [{ id: 'apple' as const, label: 'Continue with Apple', Glyph: AppleGlyph }]
    : []),
];

/** Social sign-in options for the manager portal. */
export default function SocialAuthButtons({ onError }: { onError: (message: string) => void }) {
  const [pending, setPending] = useState<SocialProvider | null>(null);

  const handle = async (provider: SocialProvider) => {
    onError('');
    setPending(provider);
    try {
      await signInWithProvider(provider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sign-in failed. Please try again.';
      // A user closing the native sheet is a cancellation, not an error worth showing.
      if (!/cancel|closed|dismiss/i.test(message)) onError(message);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="space-y-2.5">
      {PROVIDERS.map(({ id, label, Glyph }) => (
        <Button
          key={id}
          type="button"
          variant="outline"
          className="h-12 w-full gap-2.5 text-sm font-medium"
          disabled={pending !== null}
          onClick={() => handle(id)}
        >
          {pending === id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Glyph />}
          {label}
        </Button>
      ))}
    </div>
  );
}
