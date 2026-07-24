# Lesson Cards & Book Covers — Design

*2026-07-24 · brainstormed with the user on the live site; approved section by section. Implementation follows this spec.*

## Context

Two daily-use pain points, diagnosed on harmony.pwny.club:

1. **Book covers are missing** for a large share of the ~200 book resources. Covers come from OpenLibrary but are fetched only at creation time, and only on three of the six creation paths. Even on covered paths the lookup uses `limit=1` and gives up if the first match lacks `cover_i`; failures store `NULL` forever, and there is no retry, no backfill, no manual refresh.

2. **Adding content to lessons is broken/limited.** The board's "+ Add lesson card" form only takes title+URL, so the `note`/`checklist` card types that already exist in the `lesson_cards` schema are unreachable. The Edit Lesson modal's resource form offers URL/YouTube/PDF/**FileRun** — FileRun was removed from the app in round 2, and there is no way to attach a book from the existing library, add a supply, or write a text card. The list view has no add affordance at all.

**The user's mental model (drives the design):**
- **Resources** = *physical things you gather* — books, supplies. These feed Weekly Prep / the Planner's "Materials this week" panel. Store: `lesson_resources`.
- **Lesson cards** = *things that help you run the lesson* — instructions, checklists, links, videos, photos. Store: `lesson_cards`.

The board is deliberately Trello-like; that vocabulary ("cards") is the user's own.

**Approved architecture: one picker, two stores.** A single "+ Add to lesson" picker used everywhere, writing each type to the store its features already live in. No migration; the two stores are semantically different, not legacy cruft. (Unifying stores was considered and rejected — migration risk for invisible tidiness.)

## Decisions (all user-approved)

| Question | Decision |
|---|---|
| Card types | Text, Checklist, Link/video (existing), Photo upload, Book-from-library, Supply |
| Extra types considered | Divider, quiz, audio — rejected (YAGNI) |
| Picker surfaces | Board view, List view, and both Edit Lesson modals (replacing URL/YouTube/PDF/FileRun) |
| Covers | "Full fix": smarter shared lookup + all creation paths + admin backfill + per-book refresh button. Cover *picker* (choose among editions) rejected for now |
| Store unification | No (approach A) |
| Kid checklist ticks | Allowed, direct (no approval queue) — same as existing `checklist_state` behavior |

## Design

### 1. `AddToLessonPicker` (new, `components/lessons/AddToLessonPicker.tsx`)

One client component, props: `lessonId`, optional `curriculumId`, optional `onDone`. Opens as a popover/inline panel with two labeled groups:

**Lesson cards** — *how to run it* → `lesson_cards`
- **Text** — title (required) + markdown body. Saved as `card_type: 'note'` with body in `content`. Rendered with the existing `MarkdownContent`.
- **Checklist** — title + textarea, one item per line. Saved as `card_type: 'checklist'`; items in `content` (existing format the board already parses), ticks in `checklist_state`.
- **Link / video** — the current URL flow unchanged (`createLessonCard` auto-detects YouTube, fetches og/thumbnail metadata).
- **Photo** — file input, uploads through the existing uploads route (`saveUploadedImage`, image-typed, parent-only), saved as `card_type: 'image'` with the stored path as `url`.

**Materials needed** — *what to gather* → `lesson_resources`
- **Book from library** — search-as-you-type over `resources WHERE type='book'` (new small query or `/api/search` extension), results show cover thumbnails; optional "pages" field. On pick: create the resource-linked lesson card with cover (the same shape `bulkFindOrCreateAndAttachBooks` makes) **and** the `lesson_resources` row so prep/materials queries see it. If no match, offer "Create '<title>' as a new book" inline → `createGlobalResource` path (which auto-fetches a cover).
- **Supply** — textarea, one per line → existing `bulkAddSuppliesToLesson`.

All mutations go through existing or new server actions in `lib/actions/lesson-cards.ts` / `lib/actions/resources.ts`, every one starting with `requireParent()` (checklist *ticking* uses the existing kid-allowed path). New actions are thin: the schema already supports every type — `lesson_cards.card_type` enum: `checklist | youtube | url | resource | note | image`; `lesson_resources.type` includes `book | supply`. **No migrations.**

### 2. Book covers (`lib/server/book-covers.ts`, new)

One shared `findBookCover(title, author?)`:
1. OpenLibrary search with `limit=5`; take the **first doc that has `cover_i`** (not the first doc).
2. If author was given and nothing had a cover, retry title-only.
3. Return `https://covers.openlibrary.org/b/id/<id>-L.jpg` or `null`. Log misses; never throw.

Callers (replace the three copy-pasted fetch blocks; add to the two gaps):
- `createGlobalResource`, `addBookToPersonalWishlist`, `bulkFindOrCreateAndAttachBooks` (existing behavior, now shared + smarter)
- `bulkImportBooks` (booklists Bulk Import — the main gap; most cover-less books came through here)
- `bulkImportResources` (when a row is a book)

Cover lookups are best-effort: never block or fail a save.

**Backfill:** Admin page card "Fetch missing covers" → parent-gated action that iterates `resources WHERE type='book' AND thumbnail_url IS NULL`, calls `findBookCover` at ~1 request/second (OpenLibrary etiquette), updates rows, and returns a summary ("23 found, 4 not found") rendered on completion. Long-running: run server-side with a simple progress return, not a cron.

**Per-book refresh:** "Refresh cover" button in the resource edit modal → single-book action re-running `findBookCover` (works after fixing a typo'd author). Overwrites only on a found cover.

### 3. Surfaces

- **Board** (`components/curricula/CurriculumBoard.tsx`, `CardViewModal.tsx`): "+ Add lesson card" opens the picker. Text cards render as title-with-icon; click opens the existing card modal showing the markdown body. Checklist cards render items with tickboxes inline + "1/3" progress. A book pick appears as the familiar cover card in the stack (it is a resource-linked lesson card) *and* lands in materials; a supply pick only flashes a brief "Added to materials" confirmation, since supplies live in the materials list, not the card stack. Cards stay drag-reorderable (`reorderLessonCards`).
- **List view** (`components/curricula/CurriculumLessonsList.tsx`): a "+" at each row's end opens the same picker; rows gain compact chips summarizing attachments (e.g. 📄2 ☑1 📚1).
- **Edit Lesson modals** — both forks (`components/lessons/LessonFormModal.tsx` and `app/calendar/LessonFormModal.tsx`): the Resources section's URL/YouTube/PDF/FileRun form is replaced by the picker; the attached-list display stays. **Delete the FileRun option entirely.** (The fork merge remains out of scope.)

### 4. Kid behavior

Kids tick checklist boxes directly (low-stakes, mirrors current `checklist_state` handling); no approval queue involvement. Everything else in the picker is parent-only. Kid day/week views unchanged this round.

### 5. Error handling

- Cover fetch failures: log with title/author, store nothing, UI shows the current placeholder. Backfill reports per-book outcomes and continues past failures.
- Picker action failures return `{ error }` and render inline in the picker (existing action-return convention).
- Photo upload reuses the uploads route's validation (image types only, size limit).

### 6. Testing

House-style source-scan guards plus unit tests:
- `tests/book-cover-paths.test.ts` — every `INSERT INTO resources` site that can create a `'book'` must reference `findBookCover` (pattern: `per-child-completion.test.ts`).
- `findBookCover` unit test with a stubbed `fetch`: picks first-with-cover among 5, retries title-only, returns null on total miss, never throws.
- Picker card types must stay within the `lesson_cards.card_type` enum (source scan).
- Existing `authz` scan already enforces guards on new actions; keep new actions in `lib/actions/`.

### 7. Out of scope

- Migrating `lesson_resources` into `lesson_cards` (approach B)
- Merging the forked LessonFormModals (separate redesign, unchanged from round 2/3)
- Cover picker UI (choose among editions) — possible later layer on `findBookCover`
- New card types beyond the six agreed
- Any change to approvals/completion flows
- The AI Plan button (unrelated; it stays as-is)

### 8. Verification

`npx tsc --noEmit` · `npm test` · `npx next build` (Docker/colima still broken locally — round-2/3 precedent). After deploy: board add-flow for each of the six types, list-view "+", edit-modal picker, a kid ticking a checklist, one backfill run on the live library, per-book refresh on a known miss ("A Thirst for Home", "Afia the Ashanti Princess").

### Suggested implementation order

1. `lib/server/book-covers.ts` + wire all five paths + tests (independent, ships alone)
2. Admin backfill + per-book refresh
3. Picker component + text/checklist/photo/link actions + board integration
4. Book-from-library + supply flows (materials side)
5. List view "+" and chips; Edit-modal replacement + FileRun removal
