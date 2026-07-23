-- Deleting a kid account failed with a foreign-key violation whenever that kid
-- had ever completed a lesson: lesson_completions.completed_by_user_id was
-- NOT NULL REFERENCES users(id) with no ON DELETE action, so Postgres refused
-- the delete.
--
-- Make the column nullable and SET NULL on delete. The completion record and
-- its grade survive (they belong to the child, not the user account); only the
-- "who recorded this" attribution is cleared.
--
-- Data-safe: no rows are deleted or modified. Only constraint metadata changes.

ALTER TABLE lesson_completions
    ALTER COLUMN completed_by_user_id DROP NOT NULL;

ALTER TABLE lesson_completions
    DROP CONSTRAINT IF EXISTS lesson_completions_completed_by_user_id_fkey;

ALTER TABLE lesson_completions
    ADD CONSTRAINT lesson_completions_completed_by_user_id_fkey
    FOREIGN KEY (completed_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
