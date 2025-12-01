-- Enable realtime for driver_locations table
ALTER PUBLICATION supabase_realtime ADD TABLE driver_locations;

-- Enable realtime for drivers table (for name/status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE drivers;

-- Set REPLICA IDENTITY to FULL for complete row data during updates
ALTER TABLE driver_locations REPLICA IDENTITY FULL;
ALTER TABLE drivers REPLICA IDENTITY FULL;