-- Allow 'combo' as a grade_type value
ALTER TABLE curricula DROP CONSTRAINT IF EXISTS curricula_grade_type_check;
ALTER TABLE curricula ADD CONSTRAINT curricula_grade_type_check
  CHECK (grade_type IN ('numeric', 'pass_fail', 'combo'));
