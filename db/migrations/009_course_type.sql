-- Migration 009: Add curriculum/unit-study classification
ALTER TABLE curricula
ADD COLUMN IF NOT EXISTS course_type TEXT NOT NULL DEFAULT 'curriculum'
  CHECK (course_type IN ('curriculum', 'unit_study'));
