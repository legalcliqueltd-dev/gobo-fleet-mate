-- ============================================================================
-- Driver expenses & fuel log
-- ============================================================================
-- The first feature in this app that exists FOR the driver rather than about
-- him. He spends his own cash on fuel, repairs, tolls and parking, tracks it
-- on paper or not at all, then argues about it at month end. This gives him a
-- record that gets him reimbursed — and gives the manager spend-per-vehicle
-- that did not exist before.
--
-- That exchange matters operationally, not just morally: a driver who opens
-- the app for his own reasons is a driver whose phone is charged, which is
-- what every tracking feature silently depends on.
--
-- SAFE TO RE-RUN.
--
-- SECURITY MODEL: drivers are unauthenticated by design (they join with a
-- connection code, not a login), so driver-side policies key on admin_code and
-- are constrained to codes that genuinely exist. Approving or deleting is
-- restricted to the authenticated manager who owns the device holding that
-- connection code.
-- ============================================================================

create table if not exists public.driver_expenses (
  id           uuid primary key default gen_random_uuid(),
  driver_id    text not null,
  admin_code   text not null,

  -- fuel | repair | tyres | toll | parking | fine | other
  category     text not null default 'fuel',
  amount       numeric(12, 2) not null,
  currency     text not null default 'NGN',
  note         text,

  -- The receipt photo. Optional: a toll booth rarely gives one, and refusing
  -- the expense for that reason would just push him back to paper.
  photo_url    text,

  -- When the money was actually spent, which is not always when it was logged
  -- (poor signal, driving, end-of-day catch-up).
  spent_at     timestamptz not null default now(),
  latitude     double precision,
  longitude    double precision,

  -- submitted | approved | rejected
  status       text not null default 'submitted',
  review_note  text,
  reviewed_by  uuid references auth.users (id) on delete set null,
  reviewed_at  timestamptz,

  created_at   timestamptz not null default now(),

  constraint driver_expenses_amount_positive check (amount > 0),
  constraint driver_expenses_amount_sane check (amount < 100000000),
  constraint driver_expenses_status_valid
    check (status in ('submitted', 'approved', 'rejected')),
  constraint driver_expenses_category_valid
    check (category in ('fuel', 'repair', 'tyres', 'toll', 'parking', 'fine', 'other'))
);

create index if not exists driver_expenses_driver_idx
  on public.driver_expenses (driver_id, spent_at desc);
create index if not exists driver_expenses_admin_code_idx
  on public.driver_expenses (admin_code, spent_at desc);
create index if not exists driver_expenses_status_idx
  on public.driver_expenses (admin_code, status);

alter table public.driver_expenses enable row level security;

-- Readable by both sides; each app filters to its own scope.
drop policy if exists "expenses readable" on public.driver_expenses;
create policy "expenses readable"
  on public.driver_expenses for select
  using (true);

-- A driver may log an expense only against a driver_id + admin_code pair that
-- actually exists, so a fabricated code cannot inject rows.
drop policy if exists "expenses driver insert" on public.driver_expenses;
create policy "expenses driver insert"
  on public.driver_expenses for insert
  with check (
    exists (
      select 1 from public.drivers d
      where d.driver_id = driver_expenses.driver_id
        and d.admin_code = driver_expenses.admin_code
    )
  );

-- The driver may correct his own entry while it is still untouched; once a
-- manager has ruled on it, it is a record and stops being editable by him.
drop policy if exists "expenses driver update own pending" on public.driver_expenses;
create policy "expenses driver update own pending"
  on public.driver_expenses for update
  using (
    status = 'submitted'
    and exists (
      select 1 from public.drivers d
      where d.driver_id = driver_expenses.driver_id
        and d.admin_code = driver_expenses.admin_code
    )
  )
  with check (status = 'submitted');

-- Approving, rejecting and deleting belong to the manager who owns the code.
drop policy if exists "expenses owner manage" on public.driver_expenses;
create policy "expenses owner manage"
  on public.driver_expenses for update
  using (
    exists (
      select 1 from public.devices dev
      where dev.connection_code = driver_expenses.admin_code
        and dev.user_id = auth.uid()
    )
    or exists (
      select 1 from public.driver_connections dc
      where dc.connection_code = driver_expenses.admin_code
        and dc.admin_user_id = auth.uid()
    )
  );

drop policy if exists "expenses owner delete" on public.driver_expenses;
create policy "expenses owner delete"
  on public.driver_expenses for delete
  using (
    exists (
      select 1 from public.devices dev
      where dev.connection_code = driver_expenses.admin_code
        and dev.user_id = auth.uid()
    )
    or exists (
      select 1 from public.driver_connections dc
      where dc.connection_code = driver_expenses.admin_code
        and dc.admin_user_id = auth.uid()
    )
  );

-- Receipt photos, mirroring the existing public buckets.
insert into storage.buckets (id, name, public)
values ('expense-receipts', 'expense-receipts', true)
on conflict (id) do nothing;

drop policy if exists "expense receipts readable" on storage.objects;
create policy "expense receipts readable"
  on storage.objects for select
  using (bucket_id = 'expense-receipts');

drop policy if exists "expense receipts uploadable" on storage.objects;
create policy "expense receipts uploadable"
  on storage.objects for insert
  with check (bucket_id = 'expense-receipts');
