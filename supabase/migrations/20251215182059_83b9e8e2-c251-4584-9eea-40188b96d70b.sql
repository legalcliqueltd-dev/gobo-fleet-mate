-- Update the check_driver_limit function to change free tier from 3 to 1 driver
CREATE OR REPLACE FUNCTION public.check_driver_limit(admin_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  limit_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.driver_connections
  WHERE admin_user_id = admin_id AND status = 'active';
  
  -- Changed from 3 to 1 for free tier
  SELECT COALESCE(driver_limit, 1) INTO limit_count
  FROM public.admin_subscriptions
  WHERE user_id = admin_id;
  
  IF limit_count IS NULL THEN
    limit_count := 1;  -- Changed from 3 to 1 for free tier
  END IF;
  
  RETURN current_count < limit_count;
END;
$$;

-- Update table default for new admin subscriptions
ALTER TABLE public.admin_subscriptions 
  ALTER COLUMN driver_limit SET DEFAULT 1;

-- Update default features JSON to reflect new limit
ALTER TABLE public.admin_subscriptions 
  ALTER COLUMN features SET DEFAULT '{"max_drivers": 1, "advanced_analytics": false, "push_notifications": true}'::jsonb;