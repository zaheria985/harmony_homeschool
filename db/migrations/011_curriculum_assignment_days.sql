CREATE TABLE IF NOT EXISTS curriculum_assignment_days (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES curriculum_assignments(id) ON DELETE CASCADE,
    weekday         SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    UNIQUE (assignment_id, weekday)
);

CREATE INDEX IF NOT EXISTS idx_cad_assignment ON curriculum_assignment_days(assignment_id);
