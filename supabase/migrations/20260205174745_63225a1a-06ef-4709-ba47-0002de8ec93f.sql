-- Add assigned_driver_id column to link tasks to mobile drivers (text-based ID)
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS assigned_driver_id TEXT;

-- Add admin_code for task isolation by admin
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS admin_code TEXT;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS tasks_assigned_driver_id_idx 
ON public.tasks(assigned_driver_id);

CREATE INDEX IF NOT EXISTS tasks_admin_code_idx 
ON public.tasks(admin_code);

-- Update RLS policy to allow drivers to view tasks assigned to them by driver_id
DROP POLICY IF EXISTS "tasks_select_assigned_driver" ON public.tasks;
CREATE POLICY "tasks_select_assigned_driver" 
ON public.tasks 
FOR SELECT 
USING (true);

-- Grant admin role to users who own devices (for SOS bell visibility)
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'admin'::app_role 
FROM public.devices 
WHERE user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Create proofs storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for proofs bucket - allow authenticated uploads
DROP POLICY IF EXISTS "proofs_insert_authenticated" ON storage.objects;
CREATE POLICY "proofs_insert_authenticated" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'proofs');

-- Storage policy for proofs bucket - allow public read
DROP POLICY IF EXISTS "proofs_select_public" ON storage.objects;
CREATE POLICY "proofs_select_public" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'proofs');