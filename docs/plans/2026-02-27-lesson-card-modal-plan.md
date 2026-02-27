# Lesson Card Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make all lesson cards clickable to open a detail/edit modal with full content view, URL OpenGraph previews, and card reorder.

**Architecture:** New `LessonCardModal` component opens when any lesson card is clicked on the board or CardViewModal. Server-side OG metadata fetch at card creation time stored on `lesson_cards` table. Card reorder uses existing `@dnd-kit` library already in the project.

**Tech Stack:** Next.js 14, `@dnd-kit/core` + `@dnd-kit/sortable` (already installed), PostgreSQL, Zod, Tailwind semantic tokens.

---

### Task 1: Migration — Add OG metadata columns

**Files:**
- Create: `db/migrations/047_lesson_cards_og_metadata.sql`
- Modify: `db/schema.sql` (lesson_cards table definition)

**Step 1: Create migration**

```sql
-- Add OpenGraph metadata columns for URL lesson cards
ALTER TABLE lesson_cards ADD COLUMN IF NOT EXISTS og_title TEXT;
ALTER TABLE lesson_cards ADD COLUMN IF NOT EXISTS og_description TEXT;
ALTER TABLE lesson_cards ADD COLUMN IF NOT EXISTS og_image TEXT;
```

**Step 2: Update schema.sql**

Add the three columns after `thumbnail_url` in the `lesson_cards` CREATE TABLE block:
```sql
    og_title        TEXT,
    og_description  TEXT,
    og_image        TEXT,
```

**Step 3: Commit**

```
feat: add og_title, og_description, og_image columns to lesson_cards
```

---

### Task 2: Server-side OG metadata fetching

**Files:**
- Modify: `lib/actions/lesson-cards.ts`

**Step 1: Add fetchOgMeta helper**

Add after the existing `fetchYouTubeMeta` function (~line 26):

```typescript
async function fetchOgMeta(url: string): Promise<{ title?: string; description?: string; image?: string } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "Mozilla/5.0 (compatible; HarmonyBot/1.0)" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Only parse the <head> to avoid downloading full page bodies
    const head = html.split("</head>")[0] || html.slice(0, 20000);
    const og = (prop: string) => {
      const match = head.match(new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, "i"))
        || head.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, "i"));
      return match?.[1] || undefined;
    };
    const title = og("title") || head.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    const description = og("description");
    const image = og("image");
    if (!title && !description && !image) return null;
    return { title, description, image };
  } catch {
    return null;
  }
}
```

**Step 2: Call fetchOgMeta in createLessonCard**

In `createLessonCard`, after the YouTube metadata block (~line 106), add a block for URL/image types:

```typescript
  // Fetch OG metadata for URL cards
  let ogTitle: string | null = null;
  let ogDescription: string | null = null;
  let ogImage: string | null = null;
  if ((card_type === "url" || card_type === "image") && url) {
    const og = await fetchOgMeta(url);
    if (og) {
      ogTitle = og.title || null;
      ogDescription = og.description || null;
      ogImage = og.image || null;
      if (!finalTitle && ogTitle) finalTitle = ogTitle;
    }
  }
```

Update the INSERT query to include the new columns:
```sql
INSERT INTO lesson_cards (lesson_id, card_type, title, content, url, thumbnail_url, og_title, og_description, og_image, resource_id, order_index)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING id
```

With params: `[lesson_id, card_type, finalTitle, content || null, url || null, thumbnailUrl, ogTitle, ogDescription, ogImage, resource_id || null, orderRes.rows[0].next_idx]`

**Step 3: Call fetchOgMeta in bulkCreateLessonCards**

In the `bulkCreateLessonCards` loop, after the YouTube metadata block (~line 256), add OG fetch for URL/image cards:

```typescript
        let ogTitle: string | null = null;
        let ogDescription: string | null = null;
        let ogImage: string | null = null;
        if ((card.card_type === "url" || card.card_type === "image") && card.url) {
          const og = await fetchOgMeta(card.url);
          if (og) {
            ogTitle = og.title || null;
            ogDescription = og.description || null;
            ogImage = og.image || null;
            if (!finalTitle && ogTitle) finalTitle = ogTitle;
          }
        }
```

Update the INSERT to include og columns:
```sql
INSERT INTO lesson_cards (lesson_id, card_type, title, content, url, thumbnail_url, og_title, og_description, og_image, order_index)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
```

With params: `[item.lessonId, card.card_type, finalTitle, card.content || null, card.url || null, thumbnailUrl, ogTitle, ogDescription, ogImage, i]`

**Step 4: Update updateLessonCard for URL changes**

In the `if (url !== undefined)` block (~line 152), after YouTube re-detection, add OG re-fetch:

```typescript
    if (!extractYouTubeId(url)) {
      const og = await fetchOgMeta(url);
      if (og) {
        sets.push(`og_title = $${idx++}`); params.push(og.title || null);
        sets.push(`og_description = $${idx++}`); params.push(og.description || null);
        sets.push(`og_image = $${idx++}`); params.push(og.image || null);
      }
    }
```

**Step 5: Commit**

```
feat: fetch OpenGraph metadata for URL/image lesson cards
```

---

### Task 3: Update queries to return OG fields

**Files:**
- Modify: `lib/queries/lesson-cards.ts`

**Step 1: Add og columns to both queries**

In `getLessonCards` and `getLessonCardsByIds`, add to the SELECT list after `lc.thumbnail_url`:
```sql
       lc.og_title, lc.og_description, lc.og_image,
```

**Step 2: Update curricula board query**

In `lib/queries/curricula.ts`, find the lesson_cards query in `getCurriculumBoardData`. Add `og_title, og_description, og_image` to that SELECT as well.

**Step 3: Commit**

```
feat: include og metadata in lesson card queries
```

---

### Task 4: Create LessonCardModal component

**Files:**
- Create: `components/curricula/LessonCardModal.tsx`

This is the main new component. It uses the existing `Modal` base component.

**Step 1: Create the component file**

```typescript
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { updateLessonCard, deleteLessonCard, reorderLessonCards } from "@/lib/actions/lesson-cards";

type LessonCardData = {
  id: string;
  lesson_id: string;
  card_type: string;
  title: string | null;
  content: string | null;
  url: string | null;
  thumbnail_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  resource_id: string | null;
  resource_title: string | null;
  resource_url: string | null;
  resource_thumbnail_url: string | null;
  order_index: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  card: LessonCardData;
  allCards: LessonCardData[];  // All cards in this lesson, for prev/next nav
  onNavigate: (cardId: string) => void;  // Navigate to different card
};
```

**View mode layout:**
- Header: type badge + title + edit button + close
- Body switches on `card.card_type`:
  - `youtube`: iframe embed via `youtube-nocookie.com/embed/{id}` (reuse `extractYouTubeId` pattern from ResourcePreviewModal)
  - `image`: full-width `<img src={card.url}>`
  - `url`: OG preview card — `og_image` on top, `og_title` bold, `og_description` truncated, domain shown, "Open link" button
  - `checklist`: render each `- [ ]` / `- [x]` line as interactive checkbox (toggle updates content via `updateLessonCard`)
  - `note`: full `card.content` text, rendered with whitespace preserved
  - `resource`: linked resource thumbnail + title + link
- Footer: prev/next arrows using `allCards` array, showing "Card N of M"

**Edit mode layout:**
- Title input
- Card type select dropdown
- Content textarea (shown for note/checklist types)
- URL input (shown for url/youtube/image types)
- Move up / Move down buttons (call `reorderLessonCards` with swapped order_index values)
- Save button (builds FormData, calls `updateLessonCard`)
- Delete button with confirmation prompt
- Cancel button returns to view mode

**Key implementation details:**
- `useTransition` for all server action calls
- `router.refresh()` after successful save/delete/reorder
- Delete confirmation: simple `window.confirm()`
- Checklist toggle: parse content, flip the checkbox line, save via `updateLessonCard` FormData
- OG preview fallback: if no `og_title`/`og_image`, show URL domain + favicon from `https://www.google.com/s2/favicons?domain={domain}`

**Step 2: Commit**

```
feat: add LessonCardModal component with view/edit modes
```

---

### Task 5: Wire board cards to open LessonCardModal

**Files:**
- Modify: `components/curricula/CurriculumBoard.tsx`

**Step 1: Add state and import**

At the top of `CurriculumBoard.tsx`, import the new modal:
```typescript
import LessonCardModal from "@/components/curricula/LessonCardModal";
```

Add state for tracking which card is open. This goes at the board level (near `previewResource` state):
```typescript
const [openLessonCard, setOpenLessonCard] = useState<{
  card: LessonCardItem;
  allCards: LessonCardItem[];
} | null>(null);
```

**Step 2: Update LessonCardItem type**

Add the OG fields to `LessonCardItem`:
```typescript
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
```

**Step 3: Make all lesson card renders clickable**

In the sectioned layout (`LessonMiniCard`, ~line 527), wrap every card type in a clickable container. The pattern: change every `<div>`, `<a>`, and non-YouTube `<button>` to a `<button>` that calls `setOpenLessonCard(...)`. For YouTube cards specifically, keep the inline preview on click but add a small "expand" icon that opens the modal instead.

For each card type rendered in the lesson cards section:
- **youtube**: Keep existing click behavior (inline player). Add a small expand/detail icon button in the corner that opens the modal.
- **image**: Change from `<a>` to `<button>`, open modal instead of new tab.
- **url**: Change from `<a>` to `<button>`, open modal instead of new tab.
- **checklist**: Change from plain `<div>` to `<button>`, open modal on click.
- **note**: Change from plain `<div>` to `<button>`, open modal on click.
- **resource**: Change from `<a>` to `<button>`, open modal instead of new tab.

The `setOpenLessonCard` call passes: `{ card, allCards: lesson.cards }`.

**Step 4: Do the same for the non-sectioned layout** (~line 1698)

Same treatment: make all card types clickable to open the modal.

**Step 5: Render LessonCardModal at bottom of board**

Near the existing `ResourcePreviewModal` render:
```typescript
{openLessonCard && (
  <LessonCardModal
    open={!!openLessonCard}
    onClose={() => setOpenLessonCard(null)}
    card={openLessonCard.card}
    allCards={openLessonCard.allCards}
    onNavigate={(cardId) => {
      const next = openLessonCard.allCards.find((c) => c.id === cardId);
      if (next) setOpenLessonCard({ card: next, allCards: openLessonCard.allCards });
    }}
  />
)}
```

**Step 6: Commit**

```
feat: wire board lesson cards to open LessonCardModal on click
```

---

### Task 6: Wire CardViewModal cards to open LessonCardModal

**Files:**
- Modify: `components/curricula/CardViewModal.tsx`

**Step 1: Import and add state**

```typescript
import LessonCardModal from "@/components/curricula/LessonCardModal";

// Inside the component:
const [openLessonCard, setOpenLessonCard] = useState<{
  card: LessonCardItem;
  allCards: LessonCardItem[];
} | null>(null);
```

**Step 2: Make each rendered card clickable**

Same approach as Task 5 — wrap each card render in a button/clickable that calls `setOpenLessonCard({ card, allCards: lesson.cards || [] })`.

For YouTube cards: keep the inline preview but add expand icon.
For all other types: the whole card is clickable to open the modal.

**Step 3: Render the modal**

Same pattern as Task 5, render `LessonCardModal` at the bottom of the component.

**Step 4: Commit**

```
feat: wire CardViewModal lesson cards to open LessonCardModal
```

---

### Task 7: Add drag-to-reorder in CardViewModal

**Files:**
- Modify: `components/curricula/CardViewModal.tsx`

**Step 1: Import dnd-kit**

```typescript
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
```

**Step 2: Create SortableLessonCard wrapper**

```typescript
function SortableLessonCard({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <button type="button" {...attributes} {...listeners} className="mt-3 flex-shrink-0 cursor-grab text-muted hover:text-secondary active:cursor-grabbing" title="Drag to reorder">
        ⠿
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
```

**Step 3: Wrap the lesson cards list in DndContext + SortableContext**

Replace the `{(lesson.cards || []).map(...)}` block with:

```typescript
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
  <SortableContext items={(lesson.cards || []).map((c) => c.id)} strategy={verticalListSortingStrategy}>
    {(lesson.cards || []).map((card) => (
      <SortableLessonCard key={card.id} id={card.id}>
        {/* existing card render */}
      </SortableLessonCard>
    ))}
  </SortableContext>
</DndContext>
```

**Step 4: Add drag end handler**

```typescript
const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

function handleCardDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;
  const cards = lesson.cards || [];
  const oldIndex = cards.findIndex((c) => c.id === active.id);
  const newIndex = cards.findIndex((c) => c.id === over.id);
  if (oldIndex === -1 || newIndex === -1) return;

  const reordered = [...cards];
  const [moved] = reordered.splice(oldIndex, 1);
  reordered.splice(newIndex, 0, moved);

  const updates = reordered.map((c, i) => ({ id: c.id, order_index: i }));
  startTransition(async () => {
    await reorderLessonCards(updates);
    router.refresh();
  });
}
```

**Step 5: Commit**

```
feat: add drag-to-reorder for lesson cards in CardViewModal
```

---

### Task 8: Validation + final commit

**Step 1: Run tsc**
```bash
npx tsc --noEmit
```

**Step 2: Run Docker build**
```bash
docker build -t harmony-test .
```

**Step 3: Update spec**

In `docs/plans/2026-02-26-harmony-homeschool-spec.md`, update the Lesson Cards key behavior section to document:
- Lesson cards are clickable on board and in lesson detail
- LessonCardModal shows full content with view/edit modes
- URL cards display OpenGraph previews (title, description, thumbnail)
- Cards can be reordered via drag-and-drop in the lesson detail view
- OG metadata columns: `og_title`, `og_description`, `og_image`

**Step 4: Create bead, commit, push**

```bash
bd create --title="Lesson card modal + OG previews + reorder" --type=feature --priority=2
bd update <id> --status=in_progress
git add -A
git commit -m "feat: lesson card modal with view/edit, OG previews, drag reorder"
git push
bd close <id>
bd sync
```
