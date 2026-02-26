-- Add prepped flag to curricula for tracking course preparation status
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS prepped BOOLEAN NOT NULL DEFAULT false;
