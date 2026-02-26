CREATE TABLE IF NOT EXISTS curriculum_booklists (
  curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  booklist_id UUID NOT NULL REFERENCES booklists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (curriculum_id, booklist_id)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_booklists_booklist ON curriculum_booklists(booklist_id);
