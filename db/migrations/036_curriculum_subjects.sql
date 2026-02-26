-- Multi-subject curricula: junction table allowing multiple subjects per curriculum
CREATE TABLE IF NOT EXISTS curriculum_subjects (
  curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (curriculum_id, subject_id)
);
CREATE INDEX IF NOT EXISTS idx_curriculum_subjects_subject ON curriculum_subjects(subject_id);

-- Backfill from existing subject_id
INSERT INTO curriculum_subjects (curriculum_id, subject_id, is_primary)
SELECT id, subject_id, true FROM curricula WHERE subject_id IS NOT NULL
ON CONFLICT DO NOTHING;
