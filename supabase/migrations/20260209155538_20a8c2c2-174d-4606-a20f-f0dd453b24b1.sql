INSERT INTO public.user_roles (user_id, role)
VALUES ('857d4379-9a6b-4aeb-8375-1255e1e35ae7', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;