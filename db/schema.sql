-- Harmony Homeschool Tracker - Schema
-- PostgreSQL 16

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE
-- ============================================================================

CREATE TABLE children (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    emoji       TEXT,
    banner_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name        TEXT,
    child_id    UUID REFERENCES children(id) ON DELETE SET NULL,
    role        TEXT NOT NULL DEFAULT 'parent'
                    CHECK (role IN ('parent', 'kid')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE parent_children (
    parent_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    child_id    UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (parent_id, child_id)
);

CREATE INDEX idx_parent_children_parent ON parent_children(parent_id);
CREATE INDEX idx_parent_children_child ON parent_children(child_id);

CREATE TABLE school_years (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    label       TEXT NOT NULL,                          -- e.g. "2026-2027"
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    CONSTRAINT  school_years_dates_check CHECK (end_date > start_date)
);

-- Which weekdays are school days for a given year (0 = Sun … 6 = Sat)
CREATE TABLE school_days (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_year_id  UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
    weekday         SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    UNIQUE (school_year_id, weekday)
);

-- Per-date overrides: snow days, make-up days, holidays, etc.
CREATE TABLE date_overrides (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_year_id  UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
    date            DATE NOT NULL,
    type            TEXT NOT NULL CHECK (type IN ('exclude', 'include')),
    reason          TEXT,
    UNIQUE (school_year_id, date)
);

CREATE TABLE subjects (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    color           TEXT,
    thumbnail_url   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE curricula (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id  UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    description TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    cover_image TEXT,
    course_type TEXT NOT NULL DEFAULT 'curriculum'
                  CHECK (course_type IN ('curriculum', 'unit_study')),
    status      TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'archived', 'draft')),
    grade_type  TEXT NOT NULL DEFAULT 'numeric'
                  CHECK (grade_type IN ('numeric', 'pass_fail', 'combo')),
    start_date  DATE,
    end_date    DATE,
    actual_start_date DATE,
    actual_end_date   DATE,
    notes       TEXT
);

CREATE TABLE curriculum_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id   UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    school_year_id  UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (curriculum_id, child_id, school_year_id)
);

CREATE TABLE curriculum_assignment_days (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id   UUID NOT NULL REFERENCES curriculum_assignments(id) ON DELETE CASCADE,
    weekday         SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    UNIQUE (assignment_id, weekday)
);

CREATE TABLE lessons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id   UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    order_index     INTEGER NOT NULL DEFAULT 0,
    planned_date    DATE,
    status          TEXT NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'in_progress', 'completed')),
    checklist_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    archived        BOOLEAN NOT NULL DEFAULT false,
    grade_weight    NUMERIC(3,2) NOT NULL DEFAULT 1.0,
    is_recurring    BOOLEAN NOT NULL DEFAULT false,
    recurrence_rule TEXT,                                    -- e.g. 'weekly', 'daily', 'MWF', 'TTh'
    recurrence_end  DATE
);

CREATE TABLE lesson_cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    card_type       TEXT NOT NULL DEFAULT 'note'
                        CHECK (card_type IN ('checklist', 'youtube', 'url', 'resource', 'note', 'image')),
    title           TEXT,
    content         TEXT,
    url             TEXT,
    thumbnail_url   TEXT,
    resource_id     UUID REFERENCES resources(id) ON DELETE SET NULL,
    order_index     INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- RESOURCES
-- ============================================================================

CREATE TABLE resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    type            TEXT NOT NULL
                        CHECK (type IN ('book', 'video', 'pdf', 'link', 'supply', 'local_file')),
    author          TEXT,
    url             TEXT,
    thumbnail_url   TEXT,
    description     TEXT,
    category        TEXT NOT NULL DEFAULT 'learning'
                        CHECK (category IN ('learning', 'asset')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE curriculum_resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id   UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    resource_id     UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (curriculum_id, resource_id)
);

CREATE TABLE lesson_resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    resource_id     UUID REFERENCES resources(id) ON DELETE SET NULL,
    type            TEXT NOT NULL
                        CHECK (type IN ('youtube', 'pdf', 'filerun', 'url')),
    url             TEXT NOT NULL,
    title           TEXT,
    thumbnail_url   TEXT,
    page_number     INTEGER
);

CREATE TABLE lesson_completions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id           UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    child_id            UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    completed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_by_user_id UUID NOT NULL REFERENCES users(id),
    grade               NUMERIC(5,2),
    pass_fail           TEXT CHECK (pass_fail IN ('pass', 'fail')),
    notes               TEXT,
    UNIQUE (lesson_id, child_id)
);

CREATE TABLE tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE resource_tags (
    resource_id     UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (resource_id, tag_id)
);

CREATE TABLE booklists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    owner_child_id  UUID REFERENCES children(id) ON DELETE SET NULL,
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE booklist_resources (
    booklist_id     UUID NOT NULL REFERENCES booklists(id) ON DELETE CASCADE,
    resource_id     UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    position        INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (booklist_id, resource_id)
);


CREATE TABLE curriculum_booklists (
    curriculum_id   UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    booklist_id     UUID NOT NULL REFERENCES booklists(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (curriculum_id, booklist_id)
);

CREATE TABLE curriculum_subjects (
    curriculum_id   UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    subject_id      UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    is_primary      BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY (curriculum_id, subject_id)
);

CREATE TABLE curriculum_tags (
    curriculum_id   UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (curriculum_id, tag_id)
);

CREATE TABLE lesson_tags (
    lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    tag_id          UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (lesson_id, tag_id)
);

CREATE TABLE weekly_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start      DATE NOT NULL UNIQUE,
    content         TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE reading_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id     UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    date            DATE NOT NULL DEFAULT CURRENT_DATE,
    pages_read      INTEGER,
    minutes_read    INTEGER,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- EXTERNAL EVENTS
-- ============================================================================

CREATE TABLE external_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    description     TEXT,
    category        TEXT NOT NULL DEFAULT 'other'
                        CHECK (category IN ('co-op', 'sport', 'music', 'art', 'field-trip', 'other')),
    recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('once', 'weekly', 'biweekly', 'monthly')),
    day_of_week     INTEGER,
    start_date      DATE NOT NULL,
    end_date        DATE,
    start_time      TIME,
    end_time        TIME,
    all_day         BOOLEAN NOT NULL DEFAULT false,
    color           TEXT NOT NULL DEFAULT '#3b82f6',
    location        TEXT,
    travel_minutes  INTEGER,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE external_event_children (
    external_event_id UUID NOT NULL REFERENCES external_events(id) ON DELETE CASCADE,
    child_id          UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    PRIMARY KEY (external_event_id, child_id)
);

CREATE TABLE external_event_exceptions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_event_id   UUID NOT NULL REFERENCES external_events(id) ON DELETE CASCADE,
    exception_date      DATE NOT NULL,
    reason              TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (external_event_id, exception_date)
);

CREATE TABLE event_occurrence_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES external_events(id) ON DELETE CASCADE,
    occurrence_date DATE NOT NULL,
    notes           TEXT NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(event_id, occurrence_date)
);

-- ============================================================================
-- LESSON TEMPLATES
-- ============================================================================

CREATE TABLE lesson_templates (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    lessons     JSONB NOT NULL DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- GRADING SCALES
-- ============================================================================

CREATE TABLE grading_scales (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    is_default  BOOLEAN NOT NULL DEFAULT false,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE grade_thresholds (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scale_id    UUID NOT NULL REFERENCES grading_scales(id) ON DELETE CASCADE,
    letter      TEXT NOT NULL,
    min_score   NUMERIC(5,2) NOT NULL,
    color       TEXT,
    UNIQUE(scale_id, letter)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- school calendar
CREATE INDEX idx_school_days_year      ON school_days(school_year_id);
CREATE INDEX idx_date_overrides_year   ON date_overrides(school_year_id);

-- subject / curriculum / lesson hierarchy
CREATE INDEX idx_curricula_subject     ON curricula(subject_id);
CREATE INDEX idx_ca_curriculum         ON curriculum_assignments(curriculum_id);
CREATE INDEX idx_ca_child              ON curriculum_assignments(child_id);
CREATE INDEX idx_ca_school_year        ON curriculum_assignments(school_year_id);
CREATE INDEX idx_cad_assignment        ON curriculum_assignment_days(assignment_id);
CREATE INDEX idx_lessons_curriculum    ON lessons(curriculum_id);
CREATE INDEX idx_lessons_planned_date  ON lessons(planned_date);
CREATE INDEX idx_lessons_status        ON lessons(status);
CREATE INDEX idx_lessons_archived      ON lessons(archived) WHERE archived = true;

-- resources & completions
CREATE INDEX idx_resources_type                    ON resources(type);
CREATE INDEX idx_curriculum_resources_curriculum    ON curriculum_resources(curriculum_id);
CREATE INDEX idx_curriculum_resources_resource      ON curriculum_resources(resource_id);
CREATE INDEX idx_lesson_resources_lesson            ON lesson_resources(lesson_id);
CREATE INDEX idx_lesson_resources_resource          ON lesson_resources(resource_id);
CREATE INDEX idx_lesson_completions_lesson          ON lesson_completions(lesson_id);
CREATE INDEX idx_lesson_completions_child           ON lesson_completions(child_id);
CREATE INDEX idx_resource_tags_resource             ON resource_tags(resource_id);
CREATE INDEX idx_resource_tags_tag                  ON resource_tags(tag_id);
CREATE INDEX idx_reading_log_resource               ON reading_log(resource_id);
CREATE INDEX idx_reading_log_child                  ON reading_log(child_id);
CREATE INDEX idx_reading_log_date                   ON reading_log(date);
CREATE INDEX idx_curriculum_subjects_subject         ON curriculum_subjects(subject_id);
CREATE INDEX idx_curriculum_tags_tag                ON curriculum_tags(tag_id);
CREATE INDEX idx_lesson_tags_tag                    ON lesson_tags(tag_id);

CREATE INDEX idx_booklist_resources_booklist ON booklist_resources(booklist_id);
CREATE INDEX idx_booklist_resources_resource ON booklist_resources(resource_id);

-- external events
CREATE INDEX idx_external_events_dates              ON external_events(start_date, end_date);
CREATE INDEX idx_external_event_children_child_id   ON external_event_children(child_id);
CREATE INDEX idx_external_event_exceptions_event_id ON external_event_exceptions(external_event_id);
CREATE INDEX idx_event_occurrence_notes_event_id    ON event_occurrence_notes(event_id);

-- grading scales
CREATE INDEX idx_grade_thresholds_scale_id ON grade_thresholds(scale_id);
