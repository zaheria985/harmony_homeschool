-- Add archived column to lessons for end-of-year archiving
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

-- Partial index for fast filtering of archived lessons
CREATE INDEX IF NOT EXISTS idx_lessons_archived ON lessons(archived) WHERE archived = true;
