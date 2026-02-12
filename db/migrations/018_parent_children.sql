CREATE TABLE IF NOT EXISTS parent_children (
  parent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX IF NOT EXISTS idx_parent_children_parent ON parent_children(parent_id);
CREATE INDEX IF NOT EXISTS idx_parent_children_child ON parent_children(child_id);

INSERT INTO parent_children (parent_id, child_id)
SELECT u.id, c.id
FROM users u
CROSS JOIN children c
WHERE u.role = 'parent'
  AND NOT EXISTS (
    SELECT 1
    FROM parent_children pc
    WHERE pc.parent_id = u.id
      AND pc.child_id = c.id
  );
