CREATE TABLE IF NOT EXISTS lesson_tags (
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (lesson_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_lesson_tags_tag ON lesson_tags(tag_id);
