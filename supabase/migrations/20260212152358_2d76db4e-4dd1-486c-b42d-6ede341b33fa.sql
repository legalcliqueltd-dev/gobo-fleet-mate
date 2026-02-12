-- Allow anonymous uploads to sos-evidence bucket (drivers have no auth session)
CREATE POLICY "anon_upload_sos_evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'sos-evidence');

-- Allow anonymous uploads to proofs bucket (drivers have no auth session)
DROP POLICY IF EXISTS "Users can upload their own proofs" ON storage.objects;
CREATE POLICY "anon_upload_proofs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'proofs');