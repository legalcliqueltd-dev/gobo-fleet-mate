-- ============================================================================
-- Profile pictures for managers
-- ============================================================================
-- Managers only, deliberately. Drivers are unauthenticated by design — they
-- join with a connection code, not a login — so there is no auth.uid() to key
-- their storage writes on, and the only way to let them upload directly is an
-- anonymous INSERT policy of the kind expense-receipts and driver-reports
-- already carry. Rather than add a third such bucket, driver photos wait until
-- they can go through connect-driver's validateDriverIdentity and be written
-- as service_role. The `driver/` path prefix is left free for that.
--
-- Managers have no such problem: they are authenticated, so writes are scoped
-- to their own folder the way the `proofs` bucket does. There is no anonymous
-- write path in this migration.
--
-- SAFE TO RE-RUN.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Where the URL is recorded
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists avatar_url text;

comment on column public.profiles.avatar_url is
  'Public URL of the manager''s profile picture in the avatars bucket.';

-- ---------------------------------------------------------------------------
-- 2. The bucket
-- ---------------------------------------------------------------------------
-- Public read: the image is shown wherever the manager appears, and signing
-- every URL would mean re-signing on each render for no privacy gain — the
-- filenames are unguessable and it is the user's own face.
--
-- The size and MIME limits are enforced by storage before any policy runs, so
-- they hold even if a policy is later loosened.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true,
  2097152,  -- 2 MB; camera captures are resized client-side well below this
  array['image/jpeg','image/png','image/webp','image/heic']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 3. Policies — authenticated, own folder only
-- ---------------------------------------------------------------------------
drop policy if exists "avatars are publicly readable"    on storage.objects;
drop policy if exists "managers write their own avatar"  on storage.objects;
drop policy if exists "managers update their own avatar" on storage.objects;
drop policy if exists "managers delete their own avatar" on storage.objects;

create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- The uid check is what stops one manager overwriting another's picture.
create policy "managers write their own avatar"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'admin'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "managers update their own avatar"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'admin'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

create policy "managers delete their own avatar"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = 'admin'
    and (storage.foldername(name))[2] = auth.uid()::text
  );
