-- Fix search_path for check_driver_limit function
CREATE OR REPLACE FUNCTION public.check_driver_limit(admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count INTEGER;
  limit_count INTEGER;
BEGIN
  -- Get current active driver count
  SELECT COUNT(*) INTO current_count
  FROM public.driver_connections
  WHERE admin_user_id = admin_id
    AND status = 'active';
  
  -- Get subscription limit (default 3 if no subscription)
  SELECT COALESCE(driver_limit, 3) INTO limit_count
  FROM public.admin_subscriptions
  WHERE user_id = admin_id;
  
  -- If no subscription found, use default limit
  IF limit_count IS NULL THEN
    limit_count := 3;
  END IF;
  
  RETURN current_count < limit_count;
END;
$$;