-- Create geofences table for admin-managed geo-boundaries
CREATE TABLE IF NOT EXISTS public.geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  coordinates JSONB NOT NULL, -- Array of {lat, lng} objects
  type TEXT NOT NULL DEFAULT 'restricted', -- 'restricted', 'safe_zone', 'delivery_zone'
  radius_m INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for performance
CREATE INDEX idx_geofences_created_by ON public.geofences(created_by);
CREATE INDEX idx_geofences_is_active ON public.geofences(is_active);

-- Enable RLS
ALTER TABLE public.geofences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for geofences
CREATE POLICY "Admins can view geofences"
  ON public.geofences FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR created_by = auth.uid());

CREATE POLICY "Admins can create geofences"
  ON public.geofences FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') AND created_by = auth.uid());

CREATE POLICY "Admins can update their geofences"
  ON public.geofences FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Admins can delete their geofences"
  ON public.geofences FOR DELETE
  USING (created_by = auth.uid());

-- Create driver_connections table to manage admin-driver relationships
CREATE TABLE IF NOT EXISTS public.driver_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  driver_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'suspended', 'removed'
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(admin_user_id, driver_user_id)
);

-- Create index for performance
CREATE INDEX idx_driver_connections_admin ON public.driver_connections(admin_user_id);
CREATE INDEX idx_driver_connections_driver ON public.driver_connections(driver_user_id);
CREATE INDEX idx_driver_connections_status ON public.driver_connections(status);

-- Enable RLS
ALTER TABLE public.driver_connections ENABLE ROW LEVEL SECURITY;

-- RLS Policies for driver_connections
CREATE POLICY "Admins can view their driver connections"
  ON public.driver_connections FOR SELECT
  USING (admin_user_id = auth.uid() OR driver_user_id = auth.uid());

CREATE POLICY "Admins can create driver connections"
  ON public.driver_connections FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin') AND admin_user_id = auth.uid());

CREATE POLICY "Admins can update their driver connections"
  ON public.driver_connections FOR UPDATE
  USING (admin_user_id = auth.uid());

CREATE POLICY "Admins can delete their driver connections"
  ON public.driver_connections FOR DELETE
  USING (admin_user_id = auth.uid());

-- Create subscriptions table for managing admin subscription levels
CREATE TABLE IF NOT EXISTS public.admin_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  plan_name TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'business'
  driver_limit INTEGER NOT NULL DEFAULT 3,
  features JSONB DEFAULT '{"max_drivers": 3, "push_notifications": true, "advanced_analytics": false}'::jsonb,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index
CREATE INDEX idx_admin_subscriptions_user ON public.admin_subscriptions(user_id);
CREATE INDEX idx_admin_subscriptions_status ON public.admin_subscriptions(status);

-- Enable RLS
ALTER TABLE public.admin_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for subscriptions
CREATE POLICY "Users can view their own subscription"
  ON public.admin_subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "System can create subscriptions"
  ON public.admin_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own subscription"
  ON public.admin_subscriptions FOR UPDATE
  USING (user_id = auth.uid());

-- Create function to check driver limit
CREATE OR REPLACE FUNCTION public.check_driver_limit(admin_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Create function to automatically create default subscription for new admins
CREATE OR REPLACE FUNCTION public.handle_new_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user has admin role
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = NEW.user_id AND role = 'admin'
  ) THEN
    -- Create default subscription if doesn't exist
    INSERT INTO public.admin_subscriptions (user_id, plan_name, driver_limit)
    VALUES (NEW.user_id, 'free', 3)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new admin roles
DROP TRIGGER IF EXISTS on_admin_role_created ON public.user_roles;
CREATE TRIGGER on_admin_role_created
  AFTER INSERT ON public.user_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_admin();

-- Add realtime support for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.geofences;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_connections;