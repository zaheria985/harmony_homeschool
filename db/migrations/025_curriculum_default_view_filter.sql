-- Add per-curriculum default view and filter preferences
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS default_view TEXT NOT NULL DEFAULT 'board';
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS default_filter TEXT NOT NULL DEFAULT 'all';
