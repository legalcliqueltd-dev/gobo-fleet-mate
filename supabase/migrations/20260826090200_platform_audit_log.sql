-- ============================================================================
-- platform_audit_log — who changed whose plan, and why
-- ============================================================================
-- The console can hand someone a Pro plan without a payment. That is the right
-- capability to have (comping an account, repairing a webhook that never
-- fired) and the wrong one to have no record of: without a log, a granted plan
-- is indistinguishable from a payment that was never received, and the billing
-- numbers quietly stop meaning anything.
--
-- Append-only by construction: no UPDATE or DELETE policy exists, and the
-- table is written through an edge function running as service_role.
--
-- SAFE TO RE-RUN.
-- ============================================================================

create table if not exists public.platform_audit_log (
  id           uuid primary key default gen_random_uuid(),

  -- The operator. Kept even if they later lose the role.
  actor_id     uuid not null references auth.users (id) on delete cascade,
  actor_email  text,

  -- What was done: grant-plan | bulk-email
  action       text not null,

  -- Who it was done to. Null for fleet-wide actions like a bulk send.
  target_id    uuid references auth.users (id) on delete set null,
  target_email text,

  -- Enough shape to answer "what did this actually change" a year from now:
  -- { "from": {...}, "to": {...}, "reason": "...", "recipients": 42 }
  details      jsonb not null default '{}'::jsonb,

  created_at   timestamptz not null default now()
);

create index if not exists platform_audit_log_created_idx
  on public.platform_audit_log (created_at desc);
create index if not exists platform_audit_log_target_idx
  on public.platform_audit_log (target_id, created_at desc);

alter table public.platform_audit_log enable row level security;

-- Readable only by operators. No insert/update/delete policy at all, so the
-- only way in is service_role from the edge function — which is what makes
-- "append-only" true rather than merely intended.
drop policy if exists "platform owners read audit log" on public.platform_audit_log;
create policy "platform owners read audit log"
  on public.platform_audit_log
  for select
  to authenticated
  using (public.is_platform_owner());
