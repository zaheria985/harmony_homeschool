-- Change subject deletion behavior: unlink curricula instead of cascading delete
-- Step 1: Allow subject_id to be NULL on curricula
ALTER TABLE curricula ALTER COLUMN subject_id DROP NOT NULL;

-- Step 2: Drop the existing CASCADE foreign key
ALTER TABLE curricula DROP CONSTRAINT IF EXISTS curricula_subject_id_fkey;

-- Step 3: Re-add with SET NULL behavior
ALTER TABLE curricula
  ADD CONSTRAINT curricula_subject_id_fkey
  FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL;
