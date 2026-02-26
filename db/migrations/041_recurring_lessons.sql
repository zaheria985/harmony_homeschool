-- Add recurring lesson columns
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS recurrence_rule TEXT; -- e.g. 'weekly', 'daily', 'MWF', 'TTh'
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS recurrence_end DATE;
