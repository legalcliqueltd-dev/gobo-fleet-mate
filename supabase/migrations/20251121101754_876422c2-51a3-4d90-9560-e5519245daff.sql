-- Add connection code to devices table
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS connection_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS connected_driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS devices_connection_code_idx ON public.devices(connection_code);
CREATE INDEX IF NOT EXISTS devices_connected_driver_idx ON public.devices(connected_driver_id);

-- Function to generate unique connection code
CREATE OR REPLACE FUNCTION generate_connection_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  code TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8 character alphanumeric code
    code := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.devices WHERE connection_code = code) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Add comment
COMMENT ON COLUMN public.devices.connection_code IS 'Unique code that drivers can use to connect to this device';
COMMENT ON COLUMN public.devices.connected_driver_id IS 'The driver user currently connected to this device';
COMMENT ON COLUMN public.devices.connected_at IS 'When the driver connected to this device';