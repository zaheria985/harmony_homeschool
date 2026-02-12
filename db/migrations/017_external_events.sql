CREATE TABLE IF NOT EXISTS external_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('once', 'weekly', 'biweekly', 'monthly')),
  day_of_week INTEGER,
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN NOT NULL DEFAULT false,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS external_event_children (
  external_event_id UUID NOT NULL REFERENCES external_events(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  PRIMARY KEY (external_event_id, child_id)
);

CREATE TABLE IF NOT EXISTS external_event_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id UUID NOT NULL REFERENCES external_events(id) ON DELETE CASCADE,
  exception_date DATE NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_event_id, exception_date)
);

CREATE INDEX IF NOT EXISTS idx_external_events_dates ON external_events (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_external_event_children_child_id ON external_event_children (child_id);
CREATE INDEX IF NOT EXISTS idx_external_event_exceptions_event_id ON external_event_exceptions (external_event_id);
