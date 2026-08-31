-- ============================================================================
-- Make the App Store review account actually work
-- ============================================================================
-- applereview@fleettrackmate.com was created on 2026-05-01 with
-- subscription_status = 'active' and subscription_plan = 'pro', but WITHOUT
-- subscription_end_at. That column being null is the whole problem.
--
-- check-subscription grants access from the profile only when BOTH hold:
--
--     profile.subscription_status === "active" && profileEnd && profileEnd > now
--
-- With subscription_end_at null, profileEnd is null, the branch is skipped,
-- and the function falls through to trial logic keyed on trial_started_at —
-- which was set to now() on 2026-05-01. A 7-day trial from that date expired
-- in early May, so the reviewer account has read as expired ever since, and a
-- reviewer signing in would find the manager side locked.
--
-- Note this only became the operative path once 1e55464 taught the function to
-- read profile columns at all. Before that it fell through regardless.
--
-- Both fields are set here, deliberately:
--   subscription_end_at — satisfies the branch above, which is what grants
--                         access today.
--   trial_started_at    — pushed forward so that if the access logic changes
--                         again, the account still reads as a live trial
--                         rather than an expired one. Belt and braces, and the
--                         same technique 20260823090000 used for akeduye.
--
-- SAFE TO RE-RUN. Reversal statement at the bottom.
-- ============================================================================

update public.profiles p
set
  subscription_status = 'active',
  subscription_plan   = 'pro',
  -- Ten years: no review cycle will outlive it, and nobody has to remember.
  subscription_end_at = now() + interval '10 years',
  trial_started_at    = now() + interval '10 years'
from auth.users u
where u.id = p.id
  and lower(u.email) = 'applereview@fleettrackmate.com';

-- Keep the driver limit consistent. Access and capacity are read from
-- different places, and a reviewer on Pro with a Basic cap looks like a bug.
update public.admin_subscriptions s
set plan_name    = 'pro',
    driver_limit = 50,
    status       = 'active'
from auth.users u
where u.id = s.user_id
  and lower(u.email) = 'applereview@fleettrackmate.com';

-- ---------------------------------------------------------------------------
-- Verification — read these before submitting, do not assume
-- ---------------------------------------------------------------------------

-- 1. The manager account. Expect one row, 'active' / 'pro', both dates in 2036.
select u.email,
       p.subscription_status,
       p.subscription_plan,
       p.subscription_end_at,
       p.trial_started_at
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) in ('applereview@fleettrackmate.com', 'akeduye@gmail.com');

-- 2. The driver side. A reviewer cannot test the driver app without a live
--    connection code, and code management shipped a revoke path in 0b246d9 —
--    so confirm TESTCODE still exists and is attached to this account.
select d.connection_code,
       d.user_id,
       u.email as owner
from public.devices d
left join auth.users u on u.id = d.user_id
where d.connection_code = 'TESTCODE';

-- ---------------------------------------------------------------------------
-- To revoke after the app is live:
--
--   update public.profiles p
--   set subscription_status = 'expired',
--       subscription_plan   = null,
--       subscription_end_at = null,
--       trial_started_at    = now() - interval '30 days'
--   from auth.users u
--   where u.id = p.id
--     and lower(u.email) = 'applereview@fleettrackmate.com';
-- ---------------------------------------------------------------------------
