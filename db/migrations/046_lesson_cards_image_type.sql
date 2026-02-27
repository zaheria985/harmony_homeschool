-- Add 'image' to the lesson_cards card_type check constraint
ALTER TABLE lesson_cards DROP CONSTRAINT IF EXISTS lesson_cards_card_type_check;
ALTER TABLE lesson_cards ADD CONSTRAINT lesson_cards_card_type_check
    CHECK (card_type IN ('checklist', 'youtube', 'url', 'resource', 'note', 'image'));
