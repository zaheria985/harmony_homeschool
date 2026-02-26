-- 035: Grading scales with customizable letter grade thresholds

CREATE TABLE IF NOT EXISTS grading_scales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS grade_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scale_id UUID NOT NULL REFERENCES grading_scales(id) ON DELETE CASCADE,
  letter TEXT NOT NULL,
  min_score NUMERIC(5,2) NOT NULL,
  color TEXT,
  UNIQUE(scale_id, letter)
);

CREATE INDEX IF NOT EXISTS idx_grade_thresholds_scale_id ON grade_thresholds(scale_id);

-- Insert default "Standard" scale
INSERT INTO grading_scales (name, is_default) VALUES ('Standard', true)
ON CONFLICT DO NOTHING;

-- Insert default thresholds for the Standard scale
WITH standard AS (
  SELECT id FROM grading_scales WHERE name = 'Standard' AND is_default = true LIMIT 1
)
INSERT INTO grade_thresholds (scale_id, letter, min_score, color)
SELECT standard.id, v.letter, v.min_score, v.color
FROM standard,
(VALUES
  ('A', 90.00, '#22c55e'),
  ('B', 80.00, '#3b82f6'),
  ('C', 70.00, '#eab308'),
  ('D', 60.00, '#f97316'),
  ('F', 0.00,  '#ef4444')
) AS v(letter, min_score, color)
ON CONFLICT (scale_id, letter) DO NOTHING;
