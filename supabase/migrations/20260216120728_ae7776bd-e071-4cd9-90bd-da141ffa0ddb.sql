
-- Add missing columns to geofences
ALTER TABLE public.geofences
  ADD COLUMN IF NOT EXISTS center_lat double precision,
  ADD COLUMN IF NOT EXISTS center_lng double precision;

-- Create geofence_events table
CREATE TABLE public.geofence_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  geofence_id uuid NOT NULL REFERENCES public.geofences(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('enter', 'exit')),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  acknowledged boolean NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.geofence_events ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can view geofence events"
  ON public.geofence_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update geofence events"
  ON public.geofence_events FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
