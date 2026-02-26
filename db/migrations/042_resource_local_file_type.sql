-- Add local_file as a valid resource type
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_type_check;
ALTER TABLE resources ADD CONSTRAINT resources_type_check
  CHECK (type IN ('book', 'video', 'pdf', 'link', 'supply', 'local_file'));
