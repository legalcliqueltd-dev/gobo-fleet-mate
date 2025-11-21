-- Enable connected drivers to insert locations and update device status

-- Drop existing locations RLS policies
DROP POLICY IF EXISTS "locations_insert_owner_devices" ON public.locations;
DROP POLICY IF EXISTS "locations_update_owner_devices" ON public.locations;

-- Allow device owners OR connected drivers to insert locations
CREATE POLICY "locations_insert_owner_or_connected_driver"
ON public.locations
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = locations.device_id
    AND (d.user_id = auth.uid() OR d.connected_driver_id = auth.uid())
  )
);

-- Allow device owners OR connected drivers to update locations
CREATE POLICY "locations_update_owner_or_connected_driver"
ON public.locations
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = locations.device_id
    AND (d.user_id = auth.uid() OR d.connected_driver_id = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.devices d
    WHERE d.id = locations.device_id
    AND (d.user_id = auth.uid() OR d.connected_driver_id = auth.uid())
  )
);

-- Drop existing devices update policy
DROP POLICY IF EXISTS "devices_update_own" ON public.devices;

-- Allow device owners OR connected drivers to update devices (for status updates)
CREATE POLICY "devices_update_owner_or_connected_driver"
ON public.devices
FOR UPDATE
USING (
  auth.uid() = user_id OR auth.uid() = connected_driver_id
)
WITH CHECK (
  auth.uid() = user_id OR auth.uid() = connected_driver_id
);

-- Allow connected drivers to view devices they're connected to
DROP POLICY IF EXISTS "devices_select_own" ON public.devices;

CREATE POLICY "devices_select_owner_or_connected_driver"
ON public.devices
FOR SELECT
USING (
  auth.uid() = user_id OR auth.uid() = connected_driver_id
);