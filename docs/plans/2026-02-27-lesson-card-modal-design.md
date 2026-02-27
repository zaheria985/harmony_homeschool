# Lesson Card Modal — Detail/Edit View + URL Previews

**Date:** 2026-02-27

## Problem

Lesson cards on the board are not clickable (except YouTube). Notes and checklists have truncated text with no way to see the full content. URL cards have no preview — just a bare link. There's no way to edit a lesson card's fields after creation.

## Design

### LessonCardModal (new component)

A dedicated modal for viewing and editing a single lesson card. Opens when clicking any card on the board or in CardViewModal.

**View mode (default):**
- Type badge + title header
- Full content rendered by type:
  - **youtube** — inline iframe player + title
  - **image** — full-width image
  - **url** — OpenGraph preview card (og:image, og:title, og:description) + clickable link
  - **checklist** — interactive toggleable checkboxes
  - **note** — full text content
  - **resource** — linked resource details
- Prev/Next arrows to navigate between cards in the same lesson

**Edit mode (toggle via button):**
- Title input
- Card type dropdown (note, url, youtube, checklist, image)
- Content textarea (notes/checklists)
- URL input (url/youtube/image — auto-detects type on change)
- Move up / Move down buttons for reordering
- Save / Cancel / Delete (with confirmation)

### OpenGraph Metadata for URL Cards

**New columns on `lesson_cards`:**
- `og_title TEXT`
- `og_description TEXT`
- `og_image TEXT`

**Fetch:** Server-side at card creation time (in `createLessonCard` and `bulkCreateLessonCards`). Parse `<meta property="og:...">` from HTML `<head>`. 5-second timeout. Graceful fallback if no OG tags.

**Display:** Rich preview card — thumbnail on top, title, truncated description, domain. Click opens URL in new tab.

### Card Reorder in CardViewModal

Drag handles on each card in the lesson detail modal. On drop, calls existing `reorderLessonCards` action.

## Files

| File | Change |
|------|--------|
| `db/migrations/047_lesson_cards_og_metadata.sql` | Add og columns |
| `db/schema.sql` | Update lesson_cards definition |
| `lib/actions/lesson-cards.ts` | Add `fetchOgMeta()`, call in create/bulkCreate |
| `lib/queries/lesson-cards.ts` | Add og fields to SELECT |
| `components/curricula/LessonCardModal.tsx` | NEW — detail/edit modal |
| `components/curricula/CurriculumBoard.tsx` | Wire card clicks → LessonCardModal |
| `components/curricula/CardViewModal.tsx` | Wire card clicks → LessonCardModal, add drag reorder |
