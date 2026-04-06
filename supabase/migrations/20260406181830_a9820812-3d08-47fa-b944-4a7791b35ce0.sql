
CREATE TABLE public.driver_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  driver_id TEXT NOT NULL,
  admin_code TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'location_disabled',
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.driver_alerts ENABLE ROW LEVEL SECURITY;

-- Admins can read alerts for their drivers
CREATE POLICY "admins_select_driver_alerts" ON public.driver_alerts
  FOR SELECT TO authenticated
  USING (
    admin_code IN (
      SELECT connection_code FROM public.devices WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Admins can acknowledge alerts
CREATE POLICY "admins_update_driver_alerts" ON public.driver_alerts
  FOR UPDATE TO authenticated
  USING (
    admin_code IN (
      SELECT connection_code FROM public.devices WHERE user_id = auth.uid()
    )
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- Public insert via edge function (service role handles actual inserts)
CREATE POLICY "anon_insert_driver_alerts" ON public.driver_alerts
  FOR INSERT TO public
  WITH CHECK (true);
