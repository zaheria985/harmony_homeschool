-- Credit value for a course, used by the transcript. Nullable: courses have no
-- credits until a parent assigns them, and elementary work never will.
--
-- Data-safe: adds a nullable column, no rows modified.

ALTER TABLE curricula ADD COLUMN IF NOT EXISTS credits NUMERIC(4,2);
