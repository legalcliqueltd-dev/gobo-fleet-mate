-- Allow admins to delete task reports (for cascade task deletion)
CREATE POLICY "reports_delete_admin"
  ON public.task_reports
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR (EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_reports.task_id AND t.created_by = auth.uid()
    ))
  );