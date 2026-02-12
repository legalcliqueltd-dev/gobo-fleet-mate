
-- Fix: Add 'completed' to the allowed task statuses
ALTER TABLE public.tasks DROP CONSTRAINT tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status = ANY (ARRAY['assigned', 'en_route', 'completed', 'delivered', 'failed', 'cancelled']));

-- Also fix the first test task we created a report for
UPDATE public.tasks SET status = 'completed' WHERE id = '38679940-eb13-4e5d-93e2-3439931820b4';
UPDATE public.tasks SET status = 'completed' WHERE id = 'b957cc60-43fc-41c3-a631-3c38dbffd0a3';
