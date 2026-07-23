-- Append-only audit trail for actions worth being able to answer "who did that,
-- and when" about: completion approvals/rejections and account administration.
--
-- Data-safe: creates a new table only.

CREATE TABLE IF NOT EXISTS audit_log (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- SET NULL rather than CASCADE: deleting an account must not erase the
    -- record of what that account did.
    actor_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_name     TEXT,
    action         TEXT NOT NULL,
    entity_type    TEXT NOT NULL,
    entity_id      UUID,
    detail         JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
