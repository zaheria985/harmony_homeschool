-- Add OpenGraph metadata columns for URL lesson cards
ALTER TABLE lesson_cards ADD COLUMN IF NOT EXISTS og_title TEXT;
ALTER TABLE lesson_cards ADD COLUMN IF NOT EXISTS og_description TEXT;
ALTER TABLE lesson_cards ADD COLUMN IF NOT EXISTS og_image TEXT;
