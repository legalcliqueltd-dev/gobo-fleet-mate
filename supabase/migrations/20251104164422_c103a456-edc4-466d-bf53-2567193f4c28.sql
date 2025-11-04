-- Trip detection and tracking system

-- Table for trips (automatically detected journeys)
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  start_latitude DOUBLE PRECISION NOT NULL,
  start_longitude DOUBLE PRECISION NOT NULL,
  end_latitude DOUBLE PRECISION,
  end_longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  duration_minutes INTEGER,
  avg_speed_kmh DOUBLE PRECISION,
  max_speed_kmh DOUBLE PRECISION,
  status TEXT NOT NULL CHECK (status IN ('in_progress', 'completed')) DEFAULT 'in_progress',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- RLS policies for trips
CREATE POLICY "Users can view trips for their devices"
  ON public.trips FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = trips.device_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert trips"
  ON public.trips FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = trips.device_id
        AND d.user_id = auth.uid()
    )
  );

CREATE POLICY "System can update trips"
  ON public.trips FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.devices d
      WHERE d.id = trips.device_id
        AND d.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_trips_device_id ON public.trips(device_id);
CREATE INDEX idx_trips_start_time ON public.trips(start_time DESC);
CREATE INDEX idx_trips_status ON public.trips(status) WHERE status = 'in_progress';

-- Trigger for updated_at
CREATE TRIGGER update_trips_updated_at
  BEFORE UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to detect trip start/end
-- A trip starts when: device was idle (speed < 5 km/h) and now moving (speed >= 5 km/h)
-- A trip ends when: device was moving and now idle for 5+ minutes
CREATE OR REPLACE FUNCTION public.detect_trips()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  last_location RECORD;
  last_speed DOUBLE PRECISION;
  time_since_last DOUBLE PRECISION;
  active_trip RECORD;
  trip_distance DOUBLE PRECISION;
  trip_duration INTEGER;
  trip_avg_speed DOUBLE PRECISION;
  trip_max_speed DOUBLE PRECISION;
BEGIN
  -- Get the last location before this one
  SELECT latitude, longitude, speed, timestamp
  INTO last_location
  FROM public.locations
  WHERE device_id = NEW.device_id
    AND timestamp < NEW.timestamp
  ORDER BY timestamp DESC
  LIMIT 1;
  
  -- If no previous location, can't detect trip
  IF last_location IS NULL THEN
    RETURN NEW;
  END IF;
  
  last_speed := COALESCE(last_location.speed, 0);
  time_since_last := EXTRACT(EPOCH FROM (NEW.timestamp - last_location.timestamp)) / 60.0;
  
  -- Check if there's an active trip
  SELECT * INTO active_trip
  FROM public.trips
  WHERE device_id = NEW.device_id
    AND status = 'in_progress'
  ORDER BY start_time DESC
  LIMIT 1;
  
  -- Trip start detection: was idle (< 5 km/h) and now moving (>= 5 km/h)
  IF last_speed < 5 AND COALESCE(NEW.speed, 0) >= 5 AND active_trip IS NULL THEN
    INSERT INTO public.trips (
      device_id,
      start_time,
      start_latitude,
      start_longitude,
      status
    ) VALUES (
      NEW.device_id,
      NEW.timestamp,
      NEW.latitude,
      NEW.longitude,
      'in_progress'
    );
    
    RETURN NEW;
  END IF;
  
  -- Trip end detection: was moving and now idle for 5+ minutes
  IF active_trip IS NOT NULL AND COALESCE(NEW.speed, 0) < 5 AND time_since_last >= 5 THEN
    -- Calculate trip statistics
    SELECT
      SUM(CASE WHEN lat2 IS NOT NULL THEN public.haversine_km(latitude, longitude, lat2, lon2) ELSE 0 END) as distance,
      EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / 60.0 as duration,
      AVG(COALESCE(speed, 0)) as avg_speed,
      MAX(COALESCE(speed, 0)) as max_speed
    INTO trip_distance, trip_duration, trip_avg_speed, trip_max_speed
    FROM (
      SELECT
        l.latitude,
        l.longitude,
        l.speed,
        l.timestamp,
        LEAD(latitude) OVER (ORDER BY timestamp) as lat2,
        LEAD(longitude) OVER (ORDER BY timestamp) as lon2
      FROM public.locations l
      WHERE l.device_id = NEW.device_id
        AND l.timestamp >= active_trip.start_time
        AND l.timestamp <= NEW.timestamp
      ORDER BY l.timestamp
    ) pairs;
    
    -- Update the trip with end details
    UPDATE public.trips
    SET
      end_time = NEW.timestamp,
      end_latitude = NEW.latitude,
      end_longitude = NEW.longitude,
      distance_km = COALESCE(trip_distance, 0),
      duration_minutes = COALESCE(trip_duration::INTEGER, 0),
      avg_speed_kmh = COALESCE(trip_avg_speed, 0),
      max_speed_kmh = COALESCE(trip_max_speed, 0),
      status = 'completed'
    WHERE id = active_trip.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on locations table
DROP TRIGGER IF EXISTS trg_detect_trips ON public.locations;
CREATE TRIGGER trg_detect_trips
  AFTER INSERT ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_trips();

-- Enable realtime for trips
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;

-- Table for push notification subscriptions
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policies for push subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Index
CREATE INDEX idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);