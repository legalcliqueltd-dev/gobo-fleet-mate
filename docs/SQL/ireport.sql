-- iReport / Proof of Delivery Schema

-- Tasks table
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id),
  assigned_user_id uuid not null references auth.users(id),
  device_id uuid references public.devices(id),
  title text not null,
  description text,
  pickup_lat double precision,
  pickup_lng double precision,
  dropoff_lat double precision,
  dropoff_lng double precision,
  dropoff_radius_m int default 150,
  due_at timestamptz,
  status text check (status in ('assigned','en_route','delivered','failed','cancelled')) default 'assigned',
  qr_secret text,
  otp_hash text,
  otp_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists tasks_assigned_idx on public.tasks(assigned_user_id, status, due_at);
create index if not exists tasks_status_idx on public.tasks(status, created_at desc);

-- Task reports (proof of delivery)
create table if not exists public.task_reports (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id),
  delivered boolean not null,
  receiver_name text,
  receiver_phone text,
  verified_by text check (verified_by in ('qr','otp','geofence','none')) default 'none',
  otp_verified_at timestamptz,
  latitude double precision,
  longitude double precision,
  distance_to_dropoff_m int,
  note text,
  signature_url text,
  photos jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create index if not exists task_reports_task_idx on public.task_reports(task_id, created_at desc);

-- Enable RLS
alter table public.tasks enable row level security;
alter table public.task_reports enable row level security;

-- RLS: drivers see tasks assigned to them; admins see all
create policy "tasks_select_assigned_or_admin" on public.tasks
  for select using (
    assigned_user_id = auth.uid() 
    or created_by = auth.uid() 
    or public.has_role(auth.uid(), 'admin')
  );

create policy "tasks_update_assigned_or_admin" on public.tasks
  for update using (
    assigned_user_id = auth.uid() 
    or public.has_role(auth.uid(), 'admin')
  );

create policy "tasks_insert_creator_or_admin" on public.tasks
  for insert with check (
    created_by = auth.uid() 
    or public.has_role(auth.uid(), 'admin')
  );

create policy "tasks_delete_admin" on public.tasks
  for delete using (public.has_role(auth.uid(), 'admin'));

-- Reports: driver inserts for their assigned tasks, admin/creator reads
create policy "reports_select_owner_or_admin" on public.task_reports
  for select using (
    reporter_user_id = auth.uid() 
    or public.has_role(auth.uid(), 'admin')
    or exists (
      select 1 from public.tasks t 
      where t.id = task_id and t.created_by = auth.uid()
    )
  );

create policy "reports_insert_assigned" on public.task_reports
  for insert with check (
    reporter_user_id = auth.uid()
    and exists (
      select 1 from public.tasks t 
      where t.id = task_id and t.assigned_user_id = auth.uid()
    )
  );

-- Realtime
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.task_reports;

-- Storage bucket for proofs (photos and signatures)
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', false)
on conflict (id) do nothing;

-- Storage policies for proofs bucket
create policy "Users can upload their own proofs"
  on storage.objects for insert
  with check (
    bucket_id = 'proofs' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can view their own proofs"
  on storage.objects for select
  using (
    bucket_id = 'proofs' 
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Admins can view all proofs"
  on storage.objects for select
  using (
    bucket_id = 'proofs' 
    and public.has_role(auth.uid(), 'admin')
  );
