-- ============================================================================
-- Grant full access to the Play/App Store review account
-- ============================================================================
-- Reviewers must be able to reach every part of the app or the submission is
-- rejected for "restricted functionality". This gives akeduye@gmail.com
-- permanent full access, including Stations.
--
-- WHY IT IS DONE THIS WAY:
--
-- `check-subscription` decides access from `trial_started_at` whenever Stripe
-- reports no subscription — it does NOT read subscription_status from the
-- profile in that path. So simply setting subscription_status = 'active' would
-- be silently overwritten on the reviewer's very next app launch, and the
-- account would look expired again exactly when it mattered.
--
-- Pushing trial_started_at into the future is therefore the change that
-- actually works: the trial never elapses, so the account reads as a live
-- trial, which grants everything including Stations.
--
-- The subscription_* columns are set too so the record is not self
-- contradictory, and so this account behaves correctly if the edge function is
-- later fixed to read them (see the note at the bottom).
--
-- SAFE TO RE-RUN. Reverse it with the statement at the end.
-- ============================================================================

update public.profiles p
set
  -- Ten years out: the trial can never expire during any review cycle.
  trial_started_at    = now() + interval '10 years',
  subscription_status = 'active',
  subscription_plan   = 'pro',
  subscription_end_at = now() + interval '10 years'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'akeduye@gmail.com';

-- Confirm it applied. Expect exactly one row with plan 'pro'.
select u.email, p.subscription_status, p.subscription_plan, p.trial_started_at
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = 'akeduye@gmail.com';

-- ----------------------------------------------------------------------------
-- To revoke later (after the app is live), run:
--
--   update public.profiles p
--   set trial_started_at = now() - interval '30 days',
--       subscription_status = 'expired',
--       subscription_plan = null,
--       subscription_end_at = null
--   from auth.users u
--   where u.id = p.id and lower(u.email) = 'akeduye@gmail.com';
--
-- ----------------------------------------------------------------------------
-- SEPARATE BUG WORTH FIXING (not addressed here, needs an edge-function
-- deploy): check-subscription checks Stripe, and if it finds nothing falls
-- straight through to trial/expired without ever reading subscription_status,
-- subscription_plan or subscription_end_at from the profile. Paystack payments
-- are recorded ONLY in those columns, so a customer who paid with Paystack
-- would be told their access had expired. The function's own comment says it
-- means to "rely on profile data" in that branch, but the code never does.
-- ----------------------------------------------------------------------------
