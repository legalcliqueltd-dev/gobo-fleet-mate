import { useAuth } from '@/contexts/AuthContext';

/**
 * What this account is allowed to do.
 *
 * One place, so the app and the website can never drift into disagreeing about
 * who has paid for what — a disagreement the customer always notices, and
 * always in the direction that costs money.
 *
 * The model:
 *   Driver app   — free forever, no gate anywhere. It is the companion that
 *                  makes the paid product work; charging for it would break
 *                  tracking for the manager who IS paying.
 *   Trial        — everything, including stations. The trial has to show the
 *                  best feature or it is not a trial of the product.
 *   Basic        — everything except stations, and at most two drivers.
 *   Pro          — everything, unlimited drivers.
 *   Expired      — live map only (see SubscriptionGate).
 */
export function useEntitlements() {
  const { subscription, hasFullAccess } = useAuth();

  const isTrial = subscription.status === 'trial' && !subscription.trialExpired;
  const isActive = subscription.status === 'active';
  const isPro = isActive && subscription.plan === 'pro';
  const isBasic = isActive && subscription.plan !== 'pro';

  return {
    /** Still resolving; callers should not lock anything yet. */
    loading: subscription.status === 'loading',

    /** Active plan or a live trial — the general "is this account paid up". */
    hasAccess: hasFullAccess,

    isTrial,
    isBasic,
    isPro,

    /**
     * Stations are the premium feature. A trial gets them so the value is
     * visible; Basic does not, which is what Basic customers upgrade for.
     */
    canUseStations: isPro || isTrial,

    /** Basic and trial cap at two drivers; Pro is unlimited. */
    driverLimit: isPro ? Infinity : 2,
  };
}
