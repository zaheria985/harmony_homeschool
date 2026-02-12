-- Migration 004: Add curriculum_resources junction table
-- Allows resources to be attached at the curriculum level (shared across all lessons)
-- vs lesson_resources which are lesson-specific

CREATE TABLE IF NOT EXISTS curriculum_resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id   UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    resource_id     UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (curriculum_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_curriculum_resources_curriculum ON curriculum_resources(curriculum_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_resources_resource   ON curriculum_resources(resource_id);
