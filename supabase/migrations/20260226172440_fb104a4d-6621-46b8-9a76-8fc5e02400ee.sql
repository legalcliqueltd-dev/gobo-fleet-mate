
-- Update handle_new_admin to set driver_limit to 2 instead of 3
CREATE OR REPLACE FUNCTION public.handle_new_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'admin'
  ) THEN
    INSERT INTO public.admin_subscriptions (user_id, plan_name, driver_limit)
    VALUES (NEW.user_id, 'free', 2)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Update existing free-tier subscriptions from 3 to 2
UPDATE public.admin_subscriptions
SET driver_limit = 2
WHERE plan_name = 'free' AND driver_limit = 3;
