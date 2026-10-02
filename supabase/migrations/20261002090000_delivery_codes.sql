-- ============================================================================
-- Delivery codes — the customer confirms the handover, not the driver
-- ============================================================================
-- See docs/DELIVERY_CODE_SPEC.md for the reasoning. The short version:
--
-- The customer receives a 6-digit code. The driver cannot take the delivery
-- photo — and therefore cannot complete the job — until the customer has
-- inspected the goods and given him that code. If the goods are wrong the
-- customer withholds the code and photographs the problem instead.
--
-- TWO RULES THIS SCHEMA ENFORCES STRUCTURALLY
--
-- 1. THE PLAINTEXT CODE IS NEVER STORED. Only a salted SHA-256. Not even the
--    business owner may read it back (spec §2.J) — an owner who can read the
--    code can confirm deliveries themselves, and then the audit trail proves
--    only that somebody with owner access pressed a button. There is no column
--    here that could leak it, because there is no column that holds it.
--
-- 2. NOTHING IS NAMED `code` OR `admin_code`. A driver *connection* code and a
--    customer *delivery* code are different things with different lifetimes,
--    and the moment they share a word in the schema somebody will confuse them
--    (spec §4). Tenancy is reached through task_id -> tasks.admin_code, so this
--    table cannot drift out of sync with the fleet it belongs to.
--
-- SAFE TO RE-RUN.
-- ============================================================================

create table if not exists public.delivery_codes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,

  -- The 6 digits the customer tells the driver. Salted SHA-256, never plain.
  delivery_code_hash text not null,
  delivery_code_salt text not null,

  -- The long unguessable token in the customer page URL.
  -- This is NOT the code and must never be rendered as one.
  customer_token text not null unique,

  customer_name  text,
  customer_phone text,
  customer_email text,
  sent_via text[] not null default '{}',     -- email | sms | whatsapp

  -- Starts when the driver goes en route, so a job created Monday for Friday
  -- does not arrive with a four-day-old code (spec §2.F).
  valid_from timestamptz,
  expires_at timestamptz not null,

  status text not null default 'issued'
    check (status in ('issued','viewed','redeemed','rejected','refused','expired')),

  viewed_at   timestamptz,
  redeemed_at timestamptz,
  redeemed_lat double precision,
  redeemed_lng double precision,
  -- Distance from the drop-off at the moment of redemption. The number that
  -- settles a dispute, and free because the fleet is already tracked.
  redeemed_distance_m int,

  -- Why the customer refused the goods, with photographs.
  rejected_at     timestamptz,
  rejected_reason text,
  rejected_photos jsonb not null default '[]'::jsonb,

  -- Driver's counter-claim: the customer took the goods and withheld the code.
  refused_at  timestamptz,
  refused_note text,

  -- Brute force: 6 digits is a million combinations, but a patient rider with
  -- the web form could still sit and guess (spec §2.E).
  attempts     int not null default 0,
  locked_until timestamptz,

  -- Reissue (spec §2.K). Superseding a code kills the old one; there is never
  -- more than one live code for a job.
  superseded_by uuid references public.delivery_codes(id) on delete set null,
  issued_by uuid references auth.users(id),

  created_at timestamptz default now()
);

create index if not exists delivery_codes_task_idx  on public.delivery_codes(task_id);
create index if not exists delivery_codes_token_idx on public.delivery_codes(customer_token);
-- Only one live code per job, enforced by the database rather than by hope.
create unique index if not exists delivery_codes_one_live_per_task
  on public.delivery_codes(task_id)
  where status in ('issued','viewed');

alter table public.delivery_codes enable row level security;

-- --- Access --------------------------------------------------------------
-- Drivers and customers are both unauthenticated. ALL of their access goes
-- through the `delivery-code` edge function using the service role, which can
-- rate-limit, hash, and decide what to reveal. Nothing reaches this table
-- directly from a browser, so there is no anon policy at all.
--
-- The owner gets read-only access for status display. There is no plaintext to
-- expose, so this reveals nothing that breaks rule 1 above.

drop policy if exists "delivery codes owner read" on public.delivery_codes;
create policy "delivery codes owner read"
  on public.delivery_codes for select
  using (
    exists (
      select 1 from public.tasks t
      where t.id = delivery_codes.task_id
        and t.created_by = auth.uid()
    )
  );

-- Deliberately NO insert/update/delete policy for anyone.
-- Issuing, verifying, rejecting and reissuing are all service-role operations
-- in the edge function. A business owner cannot mark their own delivery
-- confirmed by writing a row, which is the entire point of the feature.

-- --- Tasks: does this job need a code at all? -----------------------------
alter table public.tasks
  add column if not exists requires_delivery_code boolean not null default false;

-- ----------------------------------------------------------------------------
-- Check it:
--
--   select column_name from information_schema.columns
--   where table_name = 'delivery_codes' and column_name ilike '%code%';
--     -> delivery_code_hash, delivery_code_salt ONLY. No bare `code`.
--
--   select count(*) from information_schema.columns
--   where table_name = 'delivery_codes' and column_name = 'admin_code';
--     -> 0
-- ----------------------------------------------------------------------------
