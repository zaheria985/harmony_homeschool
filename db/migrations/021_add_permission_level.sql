-- Add permission_level to users table
-- Options: 'full' (same as parent), 'mark_complete' (can view everything, can only mark lessons complete), 'view_only' (pure read)
ALTER TABLE users ADD COLUMN IF NOT EXISTS permission_level TEXT NOT NULL DEFAULT 'full'
  CHECK (permission_level IN ('full', 'mark_complete', 'view_only'));

-- Parents always have 'full' permissions
-- Kids get configurable permissions
