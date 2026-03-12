ALTER TABLE lesson_resources ADD CONSTRAINT lesson_resources_lesson_resource_unique UNIQUE (lesson_id, resource_id);
