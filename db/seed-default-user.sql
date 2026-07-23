-- Optional default parent user, applied by db/bootstrap.js only when the base
-- schema is first created AND SEED_DEFAULT_USER=1 (which is NOT the default).
--
-- Email: parent@harmony.local / Password: harmony123
-- This is a publicly known credential — change it immediately if you use it.
-- The preferred path is to leave SEED_DEFAULT_USER=0 and create the first
-- account through /signup, which is allowed while the users table is empty.
--
-- DO NOTHING (never DO UPDATE): this must never reset the password of an
-- account that already exists.
INSERT INTO users (email, password_hash, name, role)
VALUES (
  'parent@harmony.local',
  '$2b$10$ELfueKprRcyQmA/hAZeoaupjzHle8H2mNFp/zVuhi.rg792SloIou',
  'Parent',
  'parent'
)
ON CONFLICT (email) DO NOTHING;
