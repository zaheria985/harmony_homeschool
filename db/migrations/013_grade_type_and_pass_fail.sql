ALTER TABLE curricula
  ADD COLUMN IF NOT EXISTS grade_type TEXT NOT NULL DEFAULT 'numeric'
  CHECK (grade_type IN ('numeric', 'pass_fail'));

ALTER TABLE lesson_completions
  ADD COLUMN IF NOT EXISTS pass_fail TEXT
  CHECK (pass_fail IN ('pass', 'fail'));
