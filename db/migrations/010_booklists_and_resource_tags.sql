-- Migration 010: Resource tags and booklists

CREATE TABLE IF NOT EXISTS tags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resource_tags (
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (resource_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_resource_tags_resource ON resource_tags(resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_tags_tag      ON resource_tags(tag_id);

CREATE TABLE IF NOT EXISTS booklists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    category    TEXT NOT NULL DEFAULT 'all-ages',
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booklist_resources (
    booklist_id UUID NOT NULL REFERENCES booklists(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (booklist_id, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_booklist_resources_booklist ON booklist_resources(booklist_id);
CREATE INDEX IF NOT EXISTS idx_booklist_resources_resource ON booklist_resources(resource_id);
