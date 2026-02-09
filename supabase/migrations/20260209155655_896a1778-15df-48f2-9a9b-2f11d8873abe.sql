-- Update the handle_new_user function to default to 'admin' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Create profile entry
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  -- All web app users get admin role by default
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    'admin'::app_role
  );

  RETURN NEW;
END;
$function$;

-- Also fix existing users who only have 'driver' role - give them admin too
INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'admin'::app_role
FROM public.user_roles ur
WHERE ur.role = 'driver'
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles ur2
  WHERE ur2.user_id = ur.user_id AND ur2.role = 'admin'
)
ON CONFLICT (user_id, role) DO NOTHING;