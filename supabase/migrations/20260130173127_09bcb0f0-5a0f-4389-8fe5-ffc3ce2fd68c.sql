-- Fix SOS Evidence Storage Security
-- Make the sos-evidence bucket private and update policies

-- 1. Make the bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'sos-evidence';

-- 2. Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view SOS evidence" ON storage.objects;

-- 3. Create a secure SELECT policy - only authenticated users who are admins or the photo uploader
CREATE POLICY "Authenticated users can view SOS evidence"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'sos-evidence' 
  AND auth.role() = 'authenticated'
  AND (
    -- User is the uploader (stored in folder structure as user_id/filename)
    auth.uid()::text = (storage.foldername(name))[1]
    OR
    -- User is an admin
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
);