-- Add admin_code to sos_events to link SOS to specific admin
ALTER TABLE public.sos_events ADD COLUMN IF NOT EXISTS admin_code TEXT;
CREATE INDEX IF NOT EXISTS sos_events_admin_code_idx ON public.sos_events(admin_code);