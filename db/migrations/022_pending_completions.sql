-- Pending completions: when a non-admin marks a lesson complete, it goes to a pending queue
-- for parent/admin approval before becoming a real lesson_completion.
CREATE TABLE IF NOT EXISTS pending_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  grade NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_completions_lesson ON pending_completions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_pending_completions_child ON pending_completions(child_id);
