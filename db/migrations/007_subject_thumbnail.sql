-- Migration 007: Add thumbnail_url to subjects
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
