ALTER TABLE external_events ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE external_events ADD COLUMN IF NOT EXISTS travel_minutes INTEGER;
