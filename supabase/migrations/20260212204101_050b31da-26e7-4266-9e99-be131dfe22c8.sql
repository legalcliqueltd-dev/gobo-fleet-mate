
-- Drop the FK constraint on task_reports.reporter_user_id since code-based drivers don't have auth accounts
ALTER TABLE public.task_reports DROP CONSTRAINT IF EXISTS task_reports_reporter_user_id_fkey;
