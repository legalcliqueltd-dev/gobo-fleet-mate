-- ============================================================================
-- platform_owner: a role that actually means something
-- ============================================================================
-- WHY THIS EXISTS
--
-- `user_roles.role = 'admin'` cannot gate anything. The signup trigger in
-- 20260209155655 hands 'admin' to every account created — its own comment says
-- so: "All web app users get admin role by default". It means "this person
-- manages a fleet", not "this person runs the platform".
--
-- `bulk-email` was gating on exactly that check while accepting a caller
-- supplied subject and HTML body, so any registered customer could send
-- arbitrary mail from noreply@fleettrackmate.com to every user on the
-- platform. The button was hidden behind a client-side email allowlist, which
-- stops nobody who can call the function directly.
--
-- So: a separate role, granted to nobody by default, checked in SQL rather
-- than in React.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. The predicate every owner-only surface is built on
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so it reads user_roles regardless of the caller's own RLS,
-- and a pinned search_path so it cannot be redirected. Both are required for
-- this to be worth trusting. It is also what keeps the policy below from
-- recursing: the function runs as the table owner, which is exempt from RLS.
create or replace function public.is_platform_owner(check_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = check_user_id
      and role = 'platform_owner'::app_role
  );
$$;

comment on function public.is_platform_owner(uuid) is
  'True only for platform operators. Distinct from role=''admin'', which every signup receives and therefore grants nothing.';

-- `from public` is not enough on Supabase: the public schema carries default
-- privileges granting EXECUTE to anon/authenticated/service_role, and `anon`
-- is a distinct role rather than a member of PUBLIC. Without the explicit
-- revoke below, an unauthenticated caller can probe any user UUID and learn
-- whether that account is an operator.
revoke all on function public.is_platform_owner(uuid) from public;
revoke all on function public.is_platform_owner(uuid) from anon;
grant execute on function public.is_platform_owner(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Seed the first owner
-- ---------------------------------------------------------------------------
-- Keyed on email so this is reproducible across environments. If the account
-- does not exist yet the insert is skipped; re-run once it does.
insert into public.user_roles (user_id, role)
select id, 'platform_owner'::app_role
from auth.users
where lower(email) = lower('gobeth.ltd@gmail.com')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 3. Belt and braces against self-promotion
-- ---------------------------------------------------------------------------
-- Today this is already impossible: user_roles has RLS on with exactly one
-- permissive policy (user_roles_select_own, SELECT only), and a write with no
-- permissive policy to match is denied. The guard is here so that adding an
-- INSERT policy later — an ordinary-looking change — cannot quietly turn into
-- privilege escalation.
--
-- Scoped to INSERT and UPDATE on purpose. A restrictive FOR ALL would also
-- apply to SELECT and would stop owners' own rows being read back.
drop policy if exists "no self-service platform_owner" on public.user_roles;
drop policy if exists "no self-service platform_owner insert" on public.user_roles;
drop policy if exists "no self-service platform_owner update" on public.user_roles;

create policy "no self-service platform_owner insert"
  on public.user_roles
  as restrictive
  for insert
  to authenticated
  with check (role <> 'platform_owner'::app_role or public.is_platform_owner());

create policy "no self-service platform_owner update"
  on public.user_roles
  as restrictive
  for update
  to authenticated
  using (role <> 'platform_owner'::app_role or public.is_platform_owner())
  with check (role <> 'platform_owner'::app_role or public.is_platform_owner());
