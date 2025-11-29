-- Add DELETE policy for temp_track_sessions so owners can delete their sessions
CREATE POLICY "tts_owner_delete" ON public.temp_track_sessions
FOR DELETE USING (owner_user_id = auth.uid());