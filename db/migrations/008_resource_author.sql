-- Add optional author metadata for resources (primarily books)
ALTER TABLE resources
ADD COLUMN IF NOT EXISTS author TEXT;
