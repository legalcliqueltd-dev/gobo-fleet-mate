-- Clean up orphaned driver "Sam" who is connected to non-existent admin code D07D2EE5
DELETE FROM driver_location_history WHERE driver_id = '2d407cf9-896e-4abe-a964-ac639d14f6b1';
DELETE FROM driver_locations WHERE driver_id = '2d407cf9-896e-4abe-a964-ac639d14f6b1';
DELETE FROM drivers WHERE driver_id = '2d407cf9-896e-4abe-a964-ac639d14f6b1';