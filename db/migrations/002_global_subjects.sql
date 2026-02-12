-- Migration 002: Global Subjects Schema Redesign
-- Subjects become global (no child_id/school_year_id), curricula link to children via curriculum_assignments

-- 1. Create the curriculum_assignments junction table
CREATE TABLE IF NOT EXISTS curriculum_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id UUID NOT NULL REFERENCES curricula(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  school_year_id UUID NOT NULL REFERENCES school_years(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (curriculum_id, child_id, school_year_id)
);

-- 2-4. Data migration + old column cleanup
-- Guarded so re-running this migration is safe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subjects'
      AND column_name = 'child_id'
  )
  AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'subjects'
      AND column_name = 'school_year_id'
  ) THEN
    -- 2. Populate curriculum_assignments from legacy subject->child/year relationships
    INSERT INTO curriculum_assignments (curriculum_id, child_id, school_year_id)
    SELECT cu.id, s.child_id, s.school_year_id
    FROM curricula cu
    JOIN subjects s ON s.id = cu.subject_id
    ON CONFLICT (curriculum_id, child_id, school_year_id) DO NOTHING;

    -- 3. Deduplicate subjects by name: keep the one with the earliest created_at
    -- First, update curricula to point to the "kept" subject for each name group
    WITH kept AS (
      SELECT DISTINCT ON (name) id AS kept_id, name
      FROM subjects
      ORDER BY name, created_at ASC
    )
    UPDATE curricula cu
    SET subject_id = k.kept_id
    FROM subjects s, kept k
    WHERE cu.subject_id = s.id
      AND s.name = k.name
      AND s.id != k.kept_id;

    -- Delete duplicate subjects (those not kept)
    WITH kept AS (
      SELECT DISTINCT ON (name) id AS kept_id, name
      FROM subjects
      ORDER BY name, created_at ASC
    )
    DELETE FROM subjects
    WHERE id NOT IN (SELECT kept_id FROM kept);

    -- 4. Drop old columns and indexes from subjects
    DROP INDEX IF EXISTS idx_subjects_child;
    DROP INDEX IF EXISTS idx_subjects_year;
    ALTER TABLE subjects DROP COLUMN IF EXISTS child_id;
    ALTER TABLE subjects DROP COLUMN IF EXISTS school_year_id;
  END IF;
END $$;

-- 5. Add unique constraint on subject name (they're global now)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subjects_name_unique'
      AND conrelid = 'subjects'::regclass
  ) THEN
    ALTER TABLE subjects ADD CONSTRAINT subjects_name_unique UNIQUE (name);
  END IF;
END $$;

-- 6. Add indexes on curriculum_assignments
CREATE INDEX IF NOT EXISTS idx_ca_curriculum ON curriculum_assignments(curriculum_id);
CREATE INDEX IF NOT EXISTS idx_ca_child ON curriculum_assignments(child_id);
CREATE INDEX IF NOT EXISTS idx_ca_school_year ON curriculum_assignments(school_year_id);
