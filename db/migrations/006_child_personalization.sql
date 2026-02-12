-- Add emoji and banner photo to children
ALTER TABLE children ADD COLUMN IF NOT EXISTS emoji TEXT;
ALTER TABLE children ADD COLUMN IF NOT EXISTS banner_url TEXT;
