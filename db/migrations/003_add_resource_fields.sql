-- Migration 003: Add resource library and enhanced fields
-- Adds missing columns to curricula/lessons and creates standalone resources table

-- ============================================================================
-- CURRICULA: add cover_image, status, start_date, end_date, notes
-- ============================================================================

ALTER TABLE curricula
    ADD COLUMN IF NOT EXISTS cover_image TEXT,
    ADD COLUMN IF NOT EXISTS status      TEXT NOT NULL DEFAULT 'active'
                                         CHECK (status IN ('active', 'archived', 'draft')),
    ADD COLUMN IF NOT EXISTS start_date  DATE,
    ADD COLUMN IF NOT EXISTS end_date    DATE,
    ADD COLUMN IF NOT EXISTS notes       TEXT;

-- ============================================================================
-- LESSONS: add cover_image, estimated_duration, notes
-- ============================================================================

ALTER TABLE lessons
    ADD COLUMN IF NOT EXISTS cover_image         TEXT,
    ADD COLUMN IF NOT EXISTS estimated_duration   INTEGER,  -- minutes
    ADD COLUMN IF NOT EXISTS notes                TEXT;

-- ============================================================================
-- RESOURCES: global resource library
-- ============================================================================

CREATE TABLE IF NOT EXISTS resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    type            TEXT NOT NULL
                        CHECK (type IN ('book', 'video', 'pdf', 'link', 'supply')),
    url             TEXT,
    thumbnail_url   TEXT,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- LESSON_RESOURCES: add resource_id FK to link to resources table
-- ============================================================================

-- Add nullable resource_id to support both legacy inline resources and
-- references to the new resources table
ALTER TABLE lesson_resources
    ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES resources(id) ON DELETE SET NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_curricula_status          ON curricula(status);
CREATE INDEX IF NOT EXISTS idx_lessons_estimated_dur     ON lessons(estimated_duration);
CREATE INDEX IF NOT EXISTS idx_resources_type            ON resources(type);
CREATE INDEX IF NOT EXISTS idx_lesson_resources_resource ON lesson_resources(resource_id);
