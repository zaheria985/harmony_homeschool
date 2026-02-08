-- Harmony Homeschool Tracker - Schema
-- PostgreSQL 16

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE
-- ============================================================================

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name        TEXT,
    role        TEXT NOT NULL DEFAULT 'parent'
                    CHECK (role IN ('parent', 'kid')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE children (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    emoji       TEXT,
    banner_url  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    start_date  DATE,
    end_date    DATE,
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

CREATE TABLE lessons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id   UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    description     TEXT,
    order_index     INTEGER NOT NULL DEFAULT 0,
    planned_date    DATE,
    status          TEXT NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'in_progress', 'completed'))
);

-- ============================================================================
-- RESOURCES
-- ============================================================================

CREATE TABLE resources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title           TEXT NOT NULL,
    type            TEXT NOT NULL
                        CHECK (type IN ('book', 'video', 'pdf', 'link', 'supply')),
    author          TEXT,
    url             TEXT,
    thumbnail_url   TEXT,
    description     TEXT,
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
    UNIQUE (lesson_id, child_id)
);

-- ============================================================================
-- BOOKS
-- ============================================================================

CREATE TABLE books (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    child_id        UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    school_year_id  UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    author          TEXT,
    isbn            TEXT,
    cover_url       TEXT,
    status          TEXT NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'reading', 'completed')),
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    notes           TEXT
);

-- ============================================================================
-- AI IMPORT
-- ============================================================================

CREATE TABLE import_batches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename        TEXT,
    prompt_profile  TEXT,
    status          TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'reviewed', 'committed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE import_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        UUID NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
    item_type       TEXT NOT NULL CHECK (item_type IN ('lesson', 'book')),
    extracted_json  JSONB NOT NULL DEFAULT '{}',
    source_page     INTEGER,
    confidence      REAL,
    review_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (review_status IN ('pending', 'approved', 'rejected', 'edited')),
    reviewer_notes  TEXT
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
CREATE INDEX idx_lessons_curriculum    ON lessons(curriculum_id);
CREATE INDEX idx_lessons_planned_date  ON lessons(planned_date);
CREATE INDEX idx_lessons_status        ON lessons(status);

-- resources & completions
CREATE INDEX idx_resources_type                    ON resources(type);
CREATE INDEX idx_curriculum_resources_curriculum    ON curriculum_resources(curriculum_id);
CREATE INDEX idx_curriculum_resources_resource      ON curriculum_resources(resource_id);
CREATE INDEX idx_lesson_resources_lesson            ON lesson_resources(lesson_id);
CREATE INDEX idx_lesson_resources_resource          ON lesson_resources(resource_id);
CREATE INDEX idx_lesson_completions_lesson          ON lesson_completions(lesson_id);
CREATE INDEX idx_lesson_completions_child           ON lesson_completions(child_id);

-- books
CREATE INDEX idx_books_child           ON books(child_id);
CREATE INDEX idx_books_year            ON books(school_year_id);
CREATE INDEX idx_books_status          ON books(status);

-- AI import
CREATE INDEX idx_import_batches_user   ON import_batches(user_id);
CREATE INDEX idx_import_items_batch    ON import_items(batch_id);
CREATE INDEX idx_import_items_review   ON import_items(review_status);
