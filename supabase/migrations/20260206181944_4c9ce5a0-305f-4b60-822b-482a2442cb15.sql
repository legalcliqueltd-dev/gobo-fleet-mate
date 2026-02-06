-- Allow admins to delete resolved/cancelled SOS events
CREATE POLICY "sos_delete_resolved_admin" ON public.sos_events
  FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND status IN ('resolved', 'cancelled')
  );