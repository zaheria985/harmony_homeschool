CREATE TABLE IF NOT EXISTS curriculum_tags (
  curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (curriculum_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_tags_tag ON curriculum_tags(tag_id);
