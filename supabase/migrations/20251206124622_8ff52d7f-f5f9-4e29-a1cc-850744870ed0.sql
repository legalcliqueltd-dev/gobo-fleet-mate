-- Create storage bucket for SOS evidence photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('sos-evidence', 'sos-evidence', true)
ON CONFLICT (id) DO NOTHING;

-- Create policies for sos-evidence bucket
CREATE POLICY "Anyone can view SOS evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'sos-evidence');

CREATE POLICY "Authenticated users can upload SOS evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'sos-evidence' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own SOS evidence"
ON storage.objects FOR UPDATE
USING (bucket_id = 'sos-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own SOS evidence"
ON storage.objects FOR DELETE
USING (bucket_id = 'sos-evidence' AND auth.uid()::text = (storage.foldername(name))[1]);