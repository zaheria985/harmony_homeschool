# Board Background Image & Drag-to-Scroll Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-curriculum board background images (upload or URL) and click-drag horizontal scrolling on the board.

**Architecture:** New `background_image` column on `curricula` table. A toolbar button opens a `BackgroundPicker` popover for upload/URL/remove. The board container renders the image as a CSS background. Drag-to-scroll uses mousedown/mousemove/mouseup on the board's `overflow-x-auto` container.

**Tech Stack:** Next.js 14, Tailwind, PostgreSQL, `saveUploadedImage` from `lib/server/uploads.ts`

---

### Task 1: Migration — add background_image column

**Files:**
- Create: `db/migrations/048_curricula_background_image.sql`
- Modify: `db/schema.sql`

**Step 1: Write migration**

```sql
-- 048_curricula_background_image.sql
ALTER TABLE curricula ADD COLUMN IF NOT EXISTS background_image TEXT;
```

**Step 2: Update schema.sql**

Add `background_image TEXT,` after the `cover_image TEXT,` line in the curricula table definition.

**Step 3: Commit**

```bash
git add db/migrations/048_curricula_background_image.sql db/schema.sql
git commit -m "feat: add background_image column to curricula"
```

---

### Task 2: Server action — updateCurriculumBackground

**Files:**
- Modify: `lib/actions/lessons.ts` (add new action at bottom)

**Step 1: Add the server action**

Add `updateCurriculumBackground` action after the existing `updateCurriculum` action. It should:
- Accept `FormData` with `curriculum_id` (uuid), optional `file` (File), optional `url` (string), and a `remove` flag
- If `remove === "true"`: set `background_image = NULL`
- If `file` present: call `saveUploadedImage(file, "curricula")` from `@/lib/server/uploads`, store resulting path
- If `url` present (and no file): store the URL directly
- `UPDATE curricula SET background_image = $1 WHERE id = $2`
- `revalidatePath(/curricula/${id})`
- Return `{ success: true, background_image }` or `{ error }`

Import `saveUploadedImage` at the top of the file:
```typescript
import { saveUploadedImage } from "@/lib/server/uploads";
```

**Step 2: Commit**

```bash
git add lib/actions/lessons.ts
git commit -m "feat: add updateCurriculumBackground server action"
```

---

### Task 3: Query update — include background_image in board data

**Files:**
- Modify: `lib/queries/curricula.ts` — `getCurriculumBoardData` function

**Step 1: Add background_image to the SELECT**

In `getCurriculumBoardData`, add `cu.background_image` to the SELECT clause (line ~97, after `cu.cover_image`).

**Step 2: Commit**

```bash
git add lib/queries/curricula.ts
git commit -m "feat: include background_image in board data query"
```

---

### Task 4: BackgroundPicker component

**Files:**
- Create: `components/curricula/BackgroundPicker.tsx`

**Step 1: Create the component**

Client component (`"use client"`) with these features:
- Props: `curriculumId: string`, `currentImage: string | null`
- State: `isOpen` (popover toggle), `url` (text input), `uploading` (loading state)
- Trigger button: small image icon button (use camera/photo SVG icon), shows in the board toolbar
- Popover (positioned below the button) with:
  - **Upload tab**: `<input type="file" accept="image/*">` — on change, submit FormData with file to `updateCurriculumBackground`
  - **URL tab**: text input + "Set" button — submit FormData with url string
  - **Remove button** (only shown when `currentImage` is set): submit FormData with `remove=true`
- On success: `router.refresh()` to reload with new background
- Close popover on outside click (use a `useRef` + `useEffect` click-outside handler)
- Styling: rounded popover with `bg-surface border border-light shadow-lg p-3`, tabs as small text buttons

**Step 2: Commit**

```bash
git add components/curricula/BackgroundPicker.tsx
git commit -m "feat: add BackgroundPicker component for board backgrounds"
```

---

### Task 5: Wire background into the board page and CurriculumBoard

**Files:**
- Modify: `app/curricula/[id]/board/page.tsx`
- Modify: `components/curricula/CurriculumBoard.tsx`

**Step 1: Pass background_image to CurriculumBoard**

In `app/curricula/[id]/board/page.tsx`, add `backgroundImage={data.background_image}` prop to `<CurriculumBoard>`.

**Step 2: Update BoardProps and CurriculumBoard**

In `CurriculumBoard.tsx`:

1. Add to `BoardProps`: `backgroundImage?: string | null;`
2. Accept `backgroundImage` in the function params
3. Find the two `overflow-x-auto` containers (the board-view flex containers at lines ~1396 and ~1590). They need a wrapper.
4. For the **full-size board layout** (first `overflow-x-auto` around line 1396):
   - Wrap the entire board area (the DndContext + flex container) in a `<div>` with the background:
   ```tsx
   <div
     className="relative rounded-xl overflow-hidden"
     style={backgroundImage ? {
       backgroundImage: `url(${backgroundImage})`,
       backgroundSize: "cover",
       backgroundPosition: "center",
     } : undefined}
   >
     {backgroundImage && <div className="absolute inset-0 bg-surface/60 backdrop-blur-[2px]" />}
     <div className="relative">
       {/* existing DndContext + flex container */}
     </div>
   </div>
   ```
5. For the **compact board layout** (second `overflow-x-auto` around line 1590): same treatment.

**Step 3: Add BackgroundPicker to board toolbar**

In the board header area of `CurriculumBoard`, add a `<BackgroundPicker>` component. Find the status filter buttons area (around line 1370-1380) and add the picker next to the filters. Import `BackgroundPicker` at the top.

Pass: `curriculumId={curriculumId}` and `currentImage={backgroundImage || null}`

Only show the picker when `showAddLesson` is true (parent permission).

**Step 4: Commit**

```bash
git add app/curricula/[id]/board/page.tsx components/curricula/CurriculumBoard.tsx
git commit -m "feat: render board background image with overlay"
```

---

### Task 6: Click-drag horizontal scrolling

**Files:**
- Modify: `components/curricula/CurriculumBoard.tsx`

**Step 1: Add drag-to-scroll hook**

Create a `useDragScroll` inline function (or define above the component) that returns handlers and a ref:

```typescript
function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScrollLeft = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    // Only activate on direct container clicks (not on child elements like cards)
    if (e.target !== e.currentTarget) return;
    isDragging.current = true;
    startX.current = e.clientX;
    startScrollLeft.current = ref.current?.scrollLeft || 0;
    if (ref.current) ref.current.style.cursor = "grabbing";
    e.preventDefault();
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !ref.current) return;
    const dx = e.clientX - startX.current;
    ref.current.scrollLeft = startScrollLeft.current - dx;
  };

  const onMouseUp = () => {
    isDragging.current = false;
    if (ref.current) ref.current.style.cursor = "";
  };

  return { ref, onMouseDown, onMouseMove, onMouseUp, onMouseLeave: onMouseUp };
}
```

**Step 2: Apply to both board layouts**

1. Call `const dragScroll = useDragScroll();` (or two separate calls for two layouts: `const dragScroll1 = useDragScroll(); const dragScroll2 = useDragScroll();`).
2. On both `overflow-x-auto` flex containers, add:
   - `ref={dragScroll1.ref}`
   - `onMouseDown={dragScroll1.onMouseDown}`
   - `onMouseMove={dragScroll1.onMouseMove}`
   - `onMouseUp={dragScroll1.onMouseUp}`
   - `onMouseLeave={dragScroll1.onMouseLeave}`
   - Add `cursor-grab` to the className

**Step 3: Commit**

```bash
git add components/curricula/CurriculumBoard.tsx
git commit -m "feat: add click-drag horizontal scrolling on board"
```

---

### Task 7: Validation & spec update

**Files:**
- Run: `npx tsc --noEmit`
- Run: `docker build -t harmony-test .`
- Modify: `docs/plans/2026-02-26-harmony-homeschool-spec.md`

**Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: clean (no errors)

**Step 2: Docker build**

Run: `docker build -t harmony-test .`
Expected: `Successfully built`

**Step 3: Update spec**

In the Curricula & Lessons section, add to the curricula data model:
- `background_image TEXT` — board background image (upload path or URL)

In the Key Behaviors section, add:
- **Board background** — Each curriculum can have a custom background image for board view, set via a toolbar picker (upload or URL). Renders as `background-size: cover` with a translucent overlay for card readability. Stored in `curricula.background_image`.
- **Board drag-scroll** — The board's horizontal scroll area supports click-and-drag scrolling. Click empty space on the board and drag left/right to scroll. Cursor shows grab/grabbing states.

**Step 4: Commit and push**

```bash
git add docs/plans/2026-02-26-harmony-homeschool-spec.md
git commit -m "docs: update spec with board background and drag-scroll"
git push
```
