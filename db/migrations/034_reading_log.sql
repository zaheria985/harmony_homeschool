CREATE TABLE IF NOT EXISTS reading_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  pages_read INTEGER,
  minutes_read INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reading_log_resource ON reading_log(resource_id);
CREATE INDEX IF NOT EXISTS idx_reading_log_child ON reading_log(child_id);
CREATE INDEX IF NOT EXISTS idx_reading_log_date ON reading_log(date);
