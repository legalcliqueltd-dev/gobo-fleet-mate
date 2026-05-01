-- Create dedicated Apple App Review demo account
-- Admin user + device with connection code 'TESTCODE'

DO $$
DECLARE
  v_demo_user_id uuid;
  v_existing_user_id uuid;
BEGIN
  -- Check if demo user already exists
  SELECT id INTO v_existing_user_id FROM auth.users WHERE email = 'applereview@fleettrackmate.com' LIMIT 1;

  IF v_existing_user_id IS NOT NULL THEN
    v_demo_user_id := v_existing_user_id;
    RAISE NOTICE 'Demo user already exists: %', v_demo_user_id;
  ELSE
    v_demo_user_id := gen_random_uuid();

    -- Create the auth user
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) VALUES (
      v_demo_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'applereview@fleettrackmate.com',
      crypt('AppleReview2026!', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"],"role":"admin"}'::jsonb,
      '{"full_name":"Apple Review Demo","role":"admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );

    -- Email identity
    INSERT INTO auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), v_demo_user_id,
      jsonb_build_object('sub', v_demo_user_id::text, 'email', 'applereview@fleettrackmate.com', 'email_verified', true),
      'email', v_demo_user_id::text, now(), now(), now()
    );
  END IF;

  -- Profile
  INSERT INTO public.profiles (id, email, full_name, subscription_status, subscription_plan, trial_started_at)
  VALUES (v_demo_user_id, 'applereview@fleettrackmate.com', 'Apple Review Demo', 'active', 'pro', now())
  ON CONFLICT (id) DO UPDATE SET subscription_status='active', subscription_plan='pro';

  -- Admin role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_demo_user_id, 'admin'::app_role)
  ON CONFLICT DO NOTHING;

  -- Subscription with high driver limit so demo doesn't get blocked
  INSERT INTO public.admin_subscriptions (user_id, plan_name, driver_limit, status, features)
  VALUES (v_demo_user_id, 'pro', 50, 'active',
    '{"max_drivers": 50, "advanced_analytics": true, "push_notifications": true}'::jsonb)
  ON CONFLICT (user_id) DO UPDATE SET plan_name='pro', driver_limit=50, status='active';

  -- Device with the fixed connection code 'TESTCODE'
  -- Remove any prior device with this code (to guarantee a clean demo slate)
  DELETE FROM public.devices WHERE connection_code = 'TESTCODE' AND user_id <> v_demo_user_id;

  INSERT INTO public.devices (user_id, name, connection_code, status, is_paused)
  VALUES (v_demo_user_id, 'Demo Fleet Vehicle', 'TESTCODE', 'offline', false)
  ON CONFLICT DO NOTHING;

  -- If a device with code TESTCODE already existed for this user, ensure it's named/active
  UPDATE public.devices
  SET name = 'Demo Fleet Vehicle', is_paused = false
  WHERE user_id = v_demo_user_id AND connection_code = 'TESTCODE';

  RAISE NOTICE 'Demo setup complete. Admin user_id=%', v_demo_user_id;
END $$;