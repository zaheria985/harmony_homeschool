-- Lesson Cards: building blocks within a lesson (videos, checklists, URLs, resources, notes)
CREATE TABLE IF NOT EXISTS lesson_cards (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id       UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    card_type       TEXT NOT NULL DEFAULT 'note'
                        CHECK (card_type IN ('checklist', 'youtube', 'url', 'resource', 'note')),
    title           TEXT,
    content         TEXT,                -- checklist items (markdown), note text, etc.
    url             TEXT,                -- for youtube, url types
    thumbnail_url   TEXT,                -- auto-fetched for youtube
    resource_id     UUID REFERENCES resources(id) ON DELETE SET NULL,
    order_index     INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lesson_cards_lesson_id ON lesson_cards(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_cards_resource_id ON lesson_cards(resource_id) WHERE resource_id IS NOT NULL;
