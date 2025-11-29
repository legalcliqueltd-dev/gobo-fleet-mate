-- Create driver location history table for tracking movement
CREATE TABLE IF NOT EXISTS public.driver_location_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  admin_code TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient querying
CREATE INDEX idx_driver_location_history_driver_id ON public.driver_location_history(driver_id);
CREATE INDEX idx_driver_location_history_recorded_at ON public.driver_location_history(recorded_at DESC);
CREATE INDEX idx_driver_location_history_admin_code ON public.driver_location_history(admin_code);

-- Enable RLS
ALTER TABLE public.driver_location_history ENABLE ROW LEVEL SECURITY;

-- RLS policies - same as driver_locations
CREATE POLICY "anonymous_drivers_location_history_full_access" 
ON public.driver_location_history FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "authenticated_admins_view_driver_location_history" 
ON public.driver_location_history FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM auth.users au 
  WHERE au.id = auth.uid() 
  AND ((au.raw_user_meta_data->>'role' = 'admin') OR (au.raw_app_meta_data->>'role' = 'admin'))
));

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_location_history;