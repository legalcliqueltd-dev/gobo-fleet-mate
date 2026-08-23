import { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useEntitlements } from '@/hooks/useEntitlements';
import StationsUpsell from '@/components/admin/StationsUpsell';

/**
 * Feature gate for the native manager portal.
 *
 * Deliberately NOT the website's LockedFeature: that imports PaymentWall,
 * which drags Stripe and Paystack checkout into the native bundle and breaks
 * the guarantee `verify-native-bundle.sh` enforces (App Store guideline
 * 3.1.3(f) — a free companion to a paid web tool).
 *
 * The distinction that matters: RESTRICTING a feature is allowed on both
 * stores; SELLING inside the app is not. So this blocks, explains, and stops.
 * There is no button, no link, no checkout — the website does the selling.
 *
 * Access follows the same rule as the web: an active subscription, or a trial
 * that has not run out.
 */
export default function SubscriptionGate({
  feature,
  reason,
  requires = 'access',
  children,
}: {
  /** Named in the lock copy, so it is obvious what is being withheld. */
  feature: string;
  /** One line on why it is worth having. */
  reason?: string;
  /**
   * 'access'   — any paid-up account (blocks only when expired).
   * 'stations' — the premium tier; Basic sees the explainer instead.
   */
  requires?: 'access' | 'stations';
  children: ReactNode;
}) {
  const { hasAccess, canUseStations, loading } = useEntitlements();

  // Still resolving — locking here would flash on every cold start.
  if (loading) return <>{children}</>;

  if (requires === 'stations') {
    if (hasAccess && canUseStations) return <>{children}</>;
    // A paid-up Basic account gets taught what it is missing; an expired one
    // gets the plain lock below, because the problem there is different.
    if (hasAccess) return <StationsUpsell />;
  } else if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <Lock className="h-7 w-7 text-muted-foreground" />
      </span>

      <h2 className="font-heading text-xl font-bold text-foreground">{feature} is locked</h2>

      <p className="mt-2.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
        {reason ? `${reason} ` : ''}
        Your plan has ended, so this part of the app is unavailable.
      </p>

      <p className="mt-6 max-w-xs text-xs leading-relaxed text-muted-foreground">
        Your live map still works, and nothing has been deleted — every record is waiting for you.
        Plans are managed on fleettrackmate.com.
      </p>
    </div>
  );
}
