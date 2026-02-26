ALTER TABLE external_events ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other'
  CHECK (category IN ('co-op', 'sport', 'music', 'art', 'field-trip', 'other'));
