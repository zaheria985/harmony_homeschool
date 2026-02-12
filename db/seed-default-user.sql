-- Default parent user for Harmony Homeschool
-- Email: parent@harmony.local / Password: harmony123
-- This runs on first DB init via docker-entrypoint-initdb.d

INSERT INTO users (email, password_hash, name, role)
VALUES (
  'parent@harmony.local',
  '$2b$10$ELfueKprRcyQmA/hAZeoaupjzHle8H2mNFp/zVuhi.rg792SloIou',
  'Parent',
  'parent'
)
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
