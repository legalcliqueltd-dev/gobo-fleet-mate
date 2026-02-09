
-- =====================================================
-- 1. FIX search_path on remaining SECURITY DEFINER functions
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_roles.user_id = is_admin.user_id 
    AND role = 'admin'::app_role
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_admin_from_auth()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
SELECT EXISTS (
  SELECT 1 FROM auth.users au
  WHERE au.id = auth.uid() 
  AND (au.raw_user_meta_data->>'role' = 'admin' 
       OR au.raw_app_meta_data->>'role' = 'admin')
)
$function$;

CREATE OR REPLACE FUNCTION public.validate_admin_connection_code(p_code text)
 RETURNS TABLE(is_valid boolean, admin_user_id uuid, admin_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    SELECT 
        true AS is_valid,
        d.user_id AS admin_user_id,
        p.full_name AS admin_name
    FROM public.devices d
    LEFT JOIN public.profiles p ON d.user_id = p.id
    WHERE d.connection_code = p_code
    LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.validate_connection_code_for_registration(p_connection_code text)
 RETURNS TABLE(is_valid boolean, admin_user_id uuid, connection_id uuid, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_connection RECORD;
BEGIN
  IF p_connection_code IS NULL OR LENGTH(TRIM(p_connection_code)) < 6 THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Invalid connection code format'::TEXT;
    RETURN;
  END IF;
  SELECT * INTO v_connection
  FROM driver_connections
  WHERE UPPER(connection_code) = UPPER(TRIM(p_connection_code))
    AND status IN ('pending', 'pending_registration')
    AND driver_user_id IS NULL
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::UUID, 'Invalid or expired connection code'::TEXT;
    RETURN;
  END IF;
  RETURN QUERY SELECT true, v_connection.admin_user_id, v_connection.id, NULL::TEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_driver_auto_registration(p_connection_id uuid, p_driver_user_id uuid, p_driver_email text, p_driver_name text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result JSON;
  v_admin_id UUID;
BEGIN
  SELECT admin_user_id INTO v_admin_id FROM driver_connections WHERE id = p_connection_id;
  IF v_admin_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Connection not found');
  END IF;
  UPDATE driver_connections SET 
    driver_user_id = p_driver_user_id, status = 'active', connected_at = NOW(), auto_registered_at = NOW(),
    registration_metadata = json_build_object('email', p_driver_email, 'name', p_driver_name, 'registered_at', NOW())::jsonb
  WHERE id = p_connection_id;
  UPDATE profiles SET 
    auto_registered = true, registration_source = 'connection_code',
    full_name = COALESCE(full_name, p_driver_name), email = COALESCE(email, p_driver_email)
  WHERE id = p_driver_user_id;
  RETURN json_build_object('success', true, 'message', 'Driver successfully registered and connected',
    'connection_id', p_connection_id, 'admin_user_id', v_admin_id, 'driver_user_id', p_driver_user_id);
END;
$function$;

-- =====================================================
-- 2. FIX RLS: Tighten tasks table - restrict to authenticated users
-- =====================================================

DROP POLICY IF EXISTS "tasks_select_assigned_driver" ON public.tasks;

CREATE POLICY "tasks_select_authorized" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    created_by::uuid = auth.uid()
    OR assigned_user_id::uuid = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- =====================================================
-- 3. FIX RLS: Restrict emergency_contacts to authenticated users
-- =====================================================

DROP POLICY IF EXISTS "emergency_contacts_select" ON public.emergency_contacts;
DROP POLICY IF EXISTS "emergency_contacts_insert" ON public.emergency_contacts;
DROP POLICY IF EXISTS "emergency_contacts_update" ON public.emergency_contacts;
DROP POLICY IF EXISTS "emergency_contacts_delete" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Anyone can read emergency contacts" ON public.emergency_contacts;
DROP POLICY IF EXISTS "Authenticated users can manage emergency contacts" ON public.emergency_contacts;

CREATE POLICY "ec_select_by_admin" ON public.emergency_contacts
  FOR SELECT TO authenticated
  USING (
    admin_code IN (SELECT connection_code FROM public.devices WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "ec_insert_by_admin" ON public.emergency_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    admin_code IN (SELECT connection_code FROM public.devices WHERE user_id = auth.uid())
  );

CREATE POLICY "ec_update_by_admin" ON public.emergency_contacts
  FOR UPDATE TO authenticated
  USING (
    admin_code IN (SELECT connection_code FROM public.devices WHERE user_id = auth.uid())
  );

CREATE POLICY "ec_delete_by_admin" ON public.emergency_contacts
  FOR DELETE TO authenticated
  USING (
    admin_code IN (SELECT connection_code FROM public.devices WHERE user_id = auth.uid())
  );

-- Allow anon drivers to read emergency contacts for their fleet
CREATE POLICY "ec_select_by_driver_anon" ON public.emergency_contacts
  FOR SELECT TO anon
  USING (
    admin_code IN (SELECT admin_code FROM public.drivers WHERE status = 'active')
  );

-- =====================================================
-- 4. FIX: Re-attach trip detection trigger
-- =====================================================

DROP TRIGGER IF EXISTS trg_detect_trips ON public.locations;
CREATE TRIGGER trg_detect_trips
  AFTER INSERT ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_trips();

-- =====================================================
-- 5. ADD: Admin-as-emergency-contact functions
-- =====================================================

CREATE OR REPLACE FUNCTION public.set_admin_as_emergency_contact(
  p_admin_code text,
  p_admin_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_admin_name text;
  v_admin_email text;
  v_existing_id uuid;
BEGIN
  SELECT full_name, email INTO v_admin_name, v_admin_email
  FROM public.profiles WHERE id = p_admin_user_id;

  IF v_admin_name IS NULL AND v_admin_email IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Admin profile not found');
  END IF;

  SELECT id INTO v_existing_id
  FROM public.emergency_contacts
  WHERE admin_code = p_admin_code AND contact_type = 'admin' AND is_active = true
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.emergency_contacts
    SET contact_name = COALESCE(v_admin_name, 'Fleet Admin'),
        contact_phone = COALESCE(v_admin_email, ''),
        updated_at = NOW()
    WHERE id = v_existing_id;
    RETURN json_build_object('success', true, 'action', 'updated', 'contact_id', v_existing_id);
  ELSE
    INSERT INTO public.emergency_contacts (admin_code, contact_name, contact_phone, contact_type, contact_role, is_active)
    VALUES (p_admin_code, COALESCE(v_admin_name, 'Fleet Admin'), COALESCE(v_admin_email, ''), 'admin', 'Fleet Administrator', true)
    RETURNING id INTO v_existing_id;
    RETURN json_build_object('success', true, 'action', 'created', 'contact_id', v_existing_id);
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_driver_emergency_contacts(p_admin_code text)
RETURNS TABLE(id uuid, contact_name text, contact_phone text, contact_type text, contact_role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ec.id, ec.contact_name, ec.contact_phone, ec.contact_type, ec.contact_role
  FROM public.emergency_contacts ec
  WHERE ec.admin_code = p_admin_code AND ec.is_active = true
  ORDER BY ec.contact_type = 'admin' DESC, ec.created_at ASC;
$function$;

-- Auto-set admin as emergency contact when driver connects
CREATE OR REPLACE FUNCTION public.auto_set_admin_emergency_contact()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
    PERFORM public.set_admin_as_emergency_contact(
      NEW.admin_code,
      (SELECT user_id FROM public.devices WHERE connection_code = NEW.admin_code LIMIT 1)
    );
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_auto_admin_emergency_contact ON public.drivers;
CREATE TRIGGER trg_auto_admin_emergency_contact
  AFTER INSERT OR UPDATE ON public.drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_set_admin_emergency_contact();
