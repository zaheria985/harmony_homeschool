-- The Vikunja integration was marked deprecated in the spec and has been
-- removed from the app (its sync was not idempotent across partial failures,
-- so retries duplicated tasks). Drop the mapping table it owned.
DROP TABLE IF EXISTS vikunja_task_map;
