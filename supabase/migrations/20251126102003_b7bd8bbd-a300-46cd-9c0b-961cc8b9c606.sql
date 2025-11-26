-- =====================================================
-- FIX CRITICAL SECURITY ISSUE: Remove insecure RLS policy
-- =====================================================

-- Drop the insecure policy that allows anyone to read all connection codes
DROP POLICY IF EXISTS "Allow connection code lookup" ON public.driver_connections;

-- Drop the validation policy (also too permissive)
DROP POLICY IF EXISTS "Allow connection code validation" ON public.driver_connections;

-- Create a secure policy: Only allow reading connection codes when looking up by connection_code
-- This is still public but scoped to only matching records, not all records
CREATE POLICY "Allow connection code lookup by code"
ON public.driver_connections
FOR SELECT
USING (
  connection_code IS NOT NULL 
  AND connection_code = current_setting('request.headers', true)::json->>'x-connection-code'
);

-- Note: The connect-driver edge function doesn't actually need to query driver_connections
-- It queries the devices table instead, which has proper RLS policies
-- The above policy is just a safety measure

-- Add comment explaining the security model
COMMENT ON TABLE public.driver_connections IS 
'Driver-Admin connection records. Connection lookup should be done via devices table, not this table.';
