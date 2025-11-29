-- First, delete duplicate drivers keeping the most recent one
DELETE FROM public.drivers 
WHERE ctid NOT IN (
  SELECT DISTINCT ON (admin_code) ctid 
  FROM public.drivers 
  ORDER BY admin_code, connected_at DESC NULLS LAST
);

-- Add unique constraint on admin_code to enforce one code = one driver
ALTER TABLE public.drivers ADD CONSTRAINT drivers_admin_code_unique UNIQUE (admin_code);

-- Add unique constraint on driver_connections for proper upsert
ALTER TABLE public.driver_connections 
ADD CONSTRAINT driver_connections_admin_driver_unique 
UNIQUE (admin_user_id, driver_user_id);