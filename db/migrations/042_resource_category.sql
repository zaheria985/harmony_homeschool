ALTER TABLE resources ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'learning'
  CHECK (category IN ('learning', 'asset'));
