-- Vikunja task mapping table for two-way sync
CREATE TABLE IF NOT EXISTS vikunja_task_map (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vikunja_task_id BIGINT NOT NULL UNIQUE,
    lesson_id       UUID REFERENCES lessons(id) ON DELETE CASCADE,
    resource_id     UUID REFERENCES resources(id) ON DELETE SET NULL,
    sync_type       TEXT NOT NULL CHECK (sync_type IN ('lesson', 'resource')),
    child_id        UUID REFERENCES children(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vtm_lesson ON vikunja_task_map(lesson_id);
CREATE INDEX IF NOT EXISTS idx_vtm_vikunja ON vikunja_task_map(vikunja_task_id);
