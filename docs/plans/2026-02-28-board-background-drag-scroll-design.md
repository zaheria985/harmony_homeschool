# Board Background Image & Drag-to-Scroll

**Date:** 2026-02-28

## Board Background Image

### Data Model
- New `background_image TEXT` column on `curricula` table (nullable)
- Stores `/uploads/curricula/...` path for uploads, or full URL for pasted URLs

### UI
- Small image/camera icon button in the board header toolbar (next to existing view controls)
- Click opens a popover with two options:
  - **Upload**: file picker (accepts jpg/png/webp/gif, reuses `saveUploadedImage`)
  - **URL**: text input to paste an image URL
- "Remove background" button when a background is set
- Popover closes on selection/outside click

### Rendering
- Board outer container gets `backgroundImage` CSS with `bg-cover bg-center bg-no-repeat`
- Semi-transparent overlay (`bg-surface/70 backdrop-blur-sm`) on columns to keep cards readable
- No background on list/compact views — board view only

### Server Action
- `updateCurriculumBackground(curriculumId, formData)` — handles upload or URL, saves to `curricula.background_image`
- Revalidates `/curricula/[id]`

## Click-Drag Horizontal Scrolling

### Approach
- Pure mouse event handlers on the `overflow-x-auto` board containers
- `onMouseDown`: record starting `clientX` and `scrollLeft`, set `cursor: grabbing`
- `onMouseMove`: update `el.scrollLeft = startScrollLeft - (e.clientX - startX)`
- `onMouseUp`/`onMouseLeave`: stop tracking, reset cursor to `grab`

### Conflict Avoidance
- Only activate when the mousedown target is the scroll container itself or an empty area (not a card, button, or interactive element)
- Check `e.target === e.currentTarget` or closest non-interactive parent
- dnd-kit column drag uses PointerSensor with distance threshold — our grab scroll uses mousedown directly, so they won't conflict as long as we skip when target is inside a sortable column

### Cursor
- Default cursor on board container: `cursor-grab`
- While dragging: `cursor-grabbing`
- Pointer events on children unchanged

## Files to Touch
- `db/migrations/048_curricula_background_image.sql` — add column
- `db/schema.sql` — update
- `lib/actions/lessons.ts` — `updateCurriculumBackground` action
- `components/curricula/CurriculumBoard.tsx` — background rendering, drag-scroll handlers, toolbar button
- `components/curricula/BackgroundPicker.tsx` — new client component for the popover
- `app/api/uploads/background/route.ts` — (reuse existing upload infrastructure, may not need new route)
