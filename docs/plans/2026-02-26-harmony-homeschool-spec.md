# Harmony Homeschool Feature Specification

**Project:** Harmony Homeschool
**Version:** 1.0
**Last Updated:** 2026-02-26
**Status:** Active

## Table of Contents

1. [Overview](#overview)
2. [Feature 1: Student Management](#feature-1-student-management)
3. [Feature 2: Subject Management](#feature-2-subject-management)
4. [Feature 3: Curricula & Lessons](#feature-3-curricula--lessons)
5. [Feature 4: Week Planner](#feature-4-week-planner)
6. [Feature 5: Grades & Reports](#feature-5-grades--reports)
7. [Feature 6: Calendar](#feature-6-calendar)
8. [Feature 7: Resources & Tags](#feature-7-resources--tags)
9. [Feature 8: Booklists](#feature-8-booklists)
10. [Feature 9: External Events](#feature-9-external-events)
11. [Feature 10: Authentication & Users](#feature-10-authentication--users)
12. [Feature 11: Admin](#feature-11-admin)
13. [Feature 12: Integrations](#feature-12-integrations)

---

## Overview

Harmony Homeschool is a self-hosted homeschool tracking application for managing students, lessons, grades, schedules, and progress reports. It is designed for a single-family setup running in Docker.

### Stack & Deployment

**Backend**
- Language: TypeScript (Node.js)
- Framework: Next.js 14 (App Router)
- Database: PostgreSQL 16 (direct SQL via `pg` driver, no ORM)
- Authentication: NextAuth (JWT sessions, credentials provider)
- Validation: Zod

**Frontend**
- Type: Server-rendered web application with client-side interactivity
- Styling: Tailwind CSS only (no component libraries)
- Charts: CSS-only (no chart libraries)
- Semantic theme tokens: `bg-surface`, `text-primary`, `border-light`, `bg-interactive`, `ring-focus`

**Deployment**
- Runtime: Docker container
- Database: PostgreSQL 16 Alpine container
- Compose: `docker-compose.yml` defines app + db containers
- Volumes: PostgreSQL data and uploaded files persisted via Docker volumes
- Configuration: Environment variables for database URL, auth secrets, and optional integrations

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | — | NextAuth JWT signing secret |
| `NEXTAUTH_URL` | — | Application base URL |
| `SEED_DEFAULT_USER` | `1` | Create demo account on first boot |
| `VIKUNJA_URL` | — | Vikunja instance URL (optional, deprecated) |
| `VIKUNJA_API_TOKEN` | — | Vikunja API token (optional, deprecated) |
| `VIKUNJA_PROJECT_ID` | — | Vikunja project ID (optional, deprecated) |
| `VIKUNJA_WEBHOOK_SECRET` | — | Vikunja webhook HMAC secret (optional, deprecated) |
| `ICAL_TOKEN` | — | Token for iCal export authentication (optional) |
| `LLM_PROVIDER` | `openai` | AI provider: `openai`, `openai_compatible`, or `claude` |
| `LLM_API_KEY` | — | AI API key (optional, enables AI features) |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Override for compatible providers |
| `LLM_MODEL` | `gpt-4o` | Model to use for AI suggestions |
| `CRON_SECRET` | — | Shared secret for cron endpoint auth |
| `TRELLO_API_KEY` | — | Trello API key (optional, enables import) |
| `TRELLO_TOKEN` | — | Trello API token (optional, enables import) |

### File Organization

```
app/              # Next.js pages and API routes
components/       # Reusable UI components
lib/actions/      # Server actions (mutations)
lib/queries/      # Read-only database queries
lib/utils/        # Utility functions
db/schema.sql     # Full database schema
db/migrations/    # SQL migrations
docs/             # Documentation
```

### Database Schema Overview

**Core chain:** children → subjects (global) → curricula → curriculum_assignments → lessons → lesson_completions

All primary keys are UUID. All foreign keys are indexed. Cascading deletes are used throughout.

---

## Feature 1: Student Management

### Summary

Student Management tracks the children being homeschooled. Each child has a profile with a name, emoji avatar, and optional banner image. The student detail page aggregates progress across all assigned curricula for the active school year — showing completion stats, subject breakdown, upcoming lessons, and course status.

### Goals

- Maintain a registry of children with basic profile info
- Display per-child progress across subjects and curricula
- Scope data by school year automatically

### Out of Scope

- Multi-household / shared custody
- Student self-service profile editing

### Future Scope

- **Year-over-year progress** — Compare performance across school years (e.g. grade trends, completion rates by subject)
- **Archived year reports** — Generate and export a summary report for a completed school year

### Data Model

**children**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key, auto-generated |
| name | TEXT | Child's display name (required) |
| emoji | TEXT (nullable) | Avatar emoji for quick identification |
| banner_url | TEXT (nullable) | Path to uploaded banner image |
| created_at | TIMESTAMPTZ | Auto-set on creation |

**parent_children** (junction)

| Field | Type | Description |
|---|---|---|
| parent_id | UUID | Foreign key to users |
| child_id | UUID | Foreign key to children |
| created_at | TIMESTAMPTZ | Auto-set on creation |

Composite primary key on (parent_id, child_id). Cascading deletes on both foreign keys.

### Server Actions

| Action | Input | Description |
|---|---|---|
| `createChild(FormData)` | name (required), emoji, banner_file | Creates child record; links to current parent user |
| `updateChild(FormData)` | id, name, emoji, banner_file, clear_banner | Updates profile; supports replacing or clearing banner |
| `deleteChild(childId)` | UUID string | Hard deletes child and cascades to assignments, completions, booklists |

All actions validate with Zod, use parameterized SQL, and revalidate `/students` and `/dashboard`.

### Pages

**`/students`** — Grid of child cards showing emoji, name, subject count, and completion progress bar. Links to detail page.

**`/students/[id]`** — Detail page showing:
- Banner image (if set)
- 4-stat summary: total lessons, completed, in progress, average grade
- Per-subject breakdown with progress bars
- Next 5 upcoming lessons
- Current courses for the active school year with completion status
- Overall progress bar

### Key Behaviors

- **Parent scoping** — Parent users see only their linked children. Other roles see all children.
- **School year awareness** — Progress stats, subject breakdown, and course listings are scoped to the currently active school year (determined by `CURRENT_DATE BETWEEN start_date AND end_date`).
- **School year selector** — Dropdown on the student detail page allows browsing previous school years to review historical courses, grades, and completion rates. Filters curricula/completions by the selected year.
- **Admin-only CRUD** — Create/edit/delete UI lives in `/admin/children`, not on the student pages themselves. Supports table and gallery views with an emoji picker (30 presets) and image upload.
- **Cascading delete** — Deleting a child removes all curriculum assignments, lesson completions, and parent linkages via database cascades. Booklist `owner_child_id` is set to NULL.

---

## Feature 2: Subject Management

### Summary

Subjects are global categories (e.g. Mathematics, History, Science) that organize curricula. They are shared across all children — a single "Math" subject can have multiple curricula assigned to different children. Each subject has a name, color, and optional thumbnail image.

### Goals

- Provide a global taxonomy for organizing curricula
- Display aggregated progress across all curricula within a subject
- Support visual identification via color and thumbnail

### Out of Scope

- Per-child subject customization (subjects are intentionally global)
- Subject prerequisites or sequencing

### Future Scope

- **Multi-subject curricula** — Allow a curriculum to be tagged with one or more subjects (junction table) instead of the current single `subject_id` foreign key
- **Safe subject deletion** — *(Implemented)* Subject deletion now uses `ON DELETE SET NULL` instead of CASCADE; deleting a subject unlinks it from curricula rather than cascade-deleting them
- **Subject-level reports** — Per-subject progress reports across school years with grade trends and completion history
- **Subject templates** — Pre-built subject structures for common homeschool approaches (Classical, Charlotte Mason, etc.)

### Data Model

**subjects**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key, auto-generated |
| name | TEXT | Subject name, unique, required |
| color | TEXT (nullable) | CSS hex color for visual identification (e.g. `#6366f1`) |
| thumbnail_url | TEXT (nullable) | Path or URL to subject image |
| created_at | TIMESTAMPTZ | Auto-set on creation |

Uniqueness enforced at the database level on `name`. Deleting a subject sets `subject_id` to NULL on associated curricula via `ON DELETE SET NULL`.

### Server Actions

| Action | Input | Description |
|---|---|---|
| `createSubject(FormData)` | name (required), color, thumbnail_file | Creates a subject; thumbnail via file upload only |
| `updateSubject(FormData)` | id, name, color, thumbnail_url, thumbnail_file, clear_thumbnail | Updates subject; supports file upload, URL, or clearing thumbnail |
| `deleteSubject(subjectId)` | UUID string | Hard deletes subject; sets `subject_id` to NULL on associated curricula (no cascade) |

### Pages

**`/subjects`** — Gallery or table view of all subjects with:
- Color bar and optional thumbnail
- Curriculum count, lesson count, completion progress
- Inline editing (table view): name, color picker, thumbnail URL
- Bulk select and delete
- Child filter dropdown and search
- View toggle persisted to localStorage

**`/subjects/[id]`** — Detail page showing:
- Banner image (if thumbnail set)
- 3 stat cards: total lessons, completed count, progress percentage
- Courses list linking to `/curricula/[id]` with cover images and completion ratios
- Full lessons table with filtering, resources, and inline editing

### Key Behaviors

- **Global scope** — Subjects are not owned by any child. They are shared across the entire system. The `child_ids` array on list queries is derived from curriculum assignments, not direct ownership.
- **Color presets** — The create form offers 10 preset colors. The edit modal uses a native color picker for full customization.
- **Safe deletion** — Deleting a subject sets `subject_id` to NULL on associated curricula (`ON DELETE SET NULL`). Curricula, lessons, and completions are preserved.
- **Inline table editing** — In table view, name, color, and thumbnail URL can be edited directly without opening a modal.

---

## Feature 3: Curricula & Lessons

### Summary

Curricula and lessons form the core of Harmony Homeschool. A curriculum (course or unit study) belongs to a subject, is assigned to one or more children via a school year, and contains an ordered sequence of lessons. Each lesson can be scheduled, completed per-child, and have resources attached. The system supports drag-and-drop reordering, auto-scheduling based on school day rules, and completion copying between children sharing a curriculum.

### Goals

- Organize learning content into curricula with ordered lessons
- Assign curricula to children per school year
- Schedule lessons automatically based on configurable school days
- Track completion and grades per child independently
- Support both board (kanban) and list views for curriculum management

### Out of Scope

- Lesson dependencies / prerequisites
- Automatic grade calculation from weighted assignments
- Integration with external LMS platforms

### Future Scope

- **Completed lesson archiving** — End-of-year process to archive completed lessons as permanent records, decoupled from the curriculum structure
- **Lesson templates** — Reusable lesson structures that can be applied to new curricula
- **Curriculum sharing** — Export/import curricula between Harmony instances
- **Completion-aware status** — Currently `lesson.status` is a single shared field even though completions are per-child; decouple so each child can have independent progress on shared curricula
- **Recurring lessons** — Lessons that repeat on a schedule (e.g. daily reading) without creating individual records

### Data Model

**curricula**

| Field | Type | Status | Description |
|---|---|---|---|
| id | UUID | Exists | Primary key |
| subject_id | UUID (nullable) | Exists | Foreign key to subjects (`ON DELETE SET NULL`); null if subject deleted |
| name | TEXT | Exists | Course name, required |
| description | TEXT (nullable) | Exists | Course description |
| order_index | INTEGER | Exists | Sort order within subject, default 0 |
| cover_image | TEXT (nullable) | Exists | Path to uploaded cover image |
| course_type | TEXT | Exists | `curriculum` or `unit_study`, default `curriculum` |
| status | TEXT | Exists | `active`, `archived`, or `draft`, default `active` |
| grade_type | TEXT | Exists | `numeric`, `pass_fail`, or `combo`, default `numeric` |
| start_date | DATE (nullable) | Exists | Planned start date |
| end_date | DATE (nullable) | Exists | Planned end date |
| notes | TEXT (nullable) | Exists | Internal notes |
| prepped | BOOLEAN | Exists | Parent marks when course planning/prep is complete; default false |
| default_view | TEXT (nullable) | Exists | Preferred view mode (`board` or `list`); used by `/curricula/[id]` redirect |
| default_filter | TEXT (nullable) | Exists | Preferred lesson filter (`all`, `incomplete`, or `completed`); used by list view |
| actual_start_date | DATE (nullable) | Exists | Date the course actually started; auto-set on first lesson completion |
| actual_end_date | DATE (nullable) | Exists | Date the course was actually completed; auto-set when all lessons completed |

**curriculum_assignments**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| curriculum_id | UUID | Foreign key to curricula |
| child_id | UUID | Foreign key to children |
| school_year_id | UUID | Foreign key to school_years |
| created_at | TIMESTAMPTZ | Auto-set |

Unique constraint on (curriculum_id, child_id, school_year_id). A curriculum can be assigned to multiple children.

**curriculum_assignment_days**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| assignment_id | UUID | Foreign key to curriculum_assignments |
| weekday | SMALLINT | 0 (Sunday) through 6 (Saturday) |

Per-assignment weekday overrides. If none are set, the school year's default school days are used.

**curriculum_resources** (exists, underused)

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| curriculum_id | UUID | Foreign key to curricula |
| resource_id | UUID | Foreign key to resources |
| notes | TEXT (nullable) | Optional notes about how the resource is used in this course |
| created_at | TIMESTAMPTZ | Auto-set |

Unique on (curriculum_id, resource_id). This table exists but the UI needs better integration — particularly a flow to attach course books/resources and then easily assign them to individual lessons.

**curriculum_tags** (junction)

| Field | Type | Description |
|---|---|---|
| curriculum_id | UUID | Foreign key to curricula |
| tag_id | UUID | Foreign key to tags |
| created_at | TIMESTAMPTZ | Auto-set |

Extends the tag system to curricula. Composite primary key on (curriculum_id, tag_id).

**lessons**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key, auto-generated |
| curriculum_id | UUID | Foreign key to curricula (cascading delete) |
| title | TEXT | Lesson title, required |
| description | TEXT (nullable) | Lesson content / instructions |
| order_index | INTEGER | Sort order within curriculum, default 0 |
| planned_date | DATE (nullable) | Scheduled date |
| status | TEXT | `planned`, `in_progress`, or `completed`, default `planned` |
| section | TEXT (nullable) | Groups lessons into sections/chapters (added via migration) |
| estimated_duration | (nullable) | Estimated time (added via migration) |

**lesson_completions**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| lesson_id | UUID | Foreign key to lessons |
| child_id | UUID | Foreign key to children |
| completed_at | TIMESTAMPTZ | When completed, default now() |
| completed_by_user_id | UUID | Which user marked it complete |
| grade | NUMERIC(5,2) (nullable) | Numeric grade 0-100 |
| pass_fail | TEXT (nullable) | `pass` or `fail` |
| notes | TEXT (nullable) | Completion notes |

Unique constraint on (lesson_id, child_id).

**lesson_resources**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| lesson_id | UUID | Foreign key to lessons |
| resource_id | UUID (nullable) | Foreign key to global resources table |
| type | TEXT | `youtube`, `pdf`, `filerun`, or `url` |
| url | TEXT | Resource URL, required |
| title | TEXT (nullable) | Display title |
| thumbnail_url | TEXT (nullable) | Preview image |
| page_number | INTEGER (nullable) | Specific page reference |

**lesson_tags** (junction)

| Field | Type | Description |
|---|---|---|
| lesson_id | UUID | Foreign key to lessons |
| tag_id | UUID | Foreign key to tags |
| created_at | TIMESTAMPTZ | Auto-set |

Extends the tag system to individual lessons. Composite primary key on (lesson_id, tag_id).

### Lessons — Key Behaviors

**Student inheritance** — When a lesson is created within a curriculum, it automatically inherits all children assigned to that curriculum. Completion records are tracked per-child, but the lesson is available to all assigned students without manual assignment. If a new child is assigned to the curriculum later, they gain access to all existing lessons.

**Resource selection from course library** — When creating or editing a lesson, a resource picker displays all resources attached to the parent curriculum. The user checks off which resources apply to this specific lesson. Resources are NOT auto-assigned — each lesson's resources are intentionally curated.

**Subject and curriculum context** — Every lesson inherits and displays:
- The **subject area** from its curriculum's parent subject (name, color)
- The **curriculum name** it belongs to

These are derived via the relationship chain (`lesson -> curriculum -> subject`) and displayed on lesson views, not stored as denormalized fields.

**Lesson tags** — Lessons can be tagged using the existing tag system via a new `lesson_tags` junction table.

### Curricula — Grade Type

The `grade_type` field should support three modes:

| Value | Description |
|---|---|
| `numeric` | All lessons graded on a numeric scale (0-100) |
| `pass_fail` | All lessons graded as pass/fail |
| `combo` | Per-lesson choice — each lesson can be either numeric or pass/fail |

All three grade types are implemented.

### Curriculum Deletion

`deleteCurriculum` checks for completed lesson records before proceeding. If the curriculum has any `lesson_completions`, deletion is blocked unless `force=true` is passed. The UI prompts the user with the number of completed lessons and requires confirmation to force-delete. When `force=true` is provided (or no completions exist), `ON DELETE CASCADE` removes all lessons and completions.

### Server Actions — Curricula

| Action | Input | Description |
|---|---|---|
| `createCurriculum(FormData)` | name, subject_id, description, course_type, grade_type, status, dates, notes, cover_image_file, child_id, school_year_id | Creates curriculum; optionally creates assignment |
| `updateCurriculum(FormData)` | id + same fields | Updates curriculum; handles cover image upload/clear |
| `deleteCurriculum(id, force?)` | UUID + optional boolean | Checks for completed lessons; blocks unless `force=true` when completions exist; cascades to assignments, lessons, completions |
| `assignCurriculum(FormData)` | curriculum_id, child_id, school_year_id | Creates assignment (upsert) |
| `unassignCurriculum(id, childId)` | Two UUIDs | Removes assignment |

### Server Actions — Lessons

| Action | Input | Description |
|---|---|---|
| `createLesson(FormData)` | title, curriculum_id, planned_date, description, section | Creates single lesson |
| `updateLesson(FormData)` | id, title, curriculum_id, planned_date, description | Updates lesson metadata |
| `deleteLesson(id)` | UUID | Deletes single lesson |
| `bulkDeleteLessons(ids)` | UUID[] (max 500) | Batch delete |
| `bulkCreateLessons(lessons, options)` | Up to 2000 lessons with optional childIds and schoolYearId | Batch import with auto-completion records |
| `updateLessonStatus(id, status)` | UUID + status enum | Changes lesson status |
| `updateLessonTitle(id, title)` | UUID + string | Inline title edit |
| `reorderLessons(updates)` | Array of {id, order_index, section} (max 2000) | Batch reorder from drag-and-drop |
| `rescheduleLesson(id, date)` | UUID + date string | Moves lesson and cascades subsequent lessons forward |
| `bulkUpdateLessonDate(ids, date)` | UUID[] + date | Set same date on multiple lessons |
| `bulkUpdateLessonStatus(ids, status)` | UUID[] + status | Set same status on multiple lessons |

### Server Actions — Completions

| Action | Input | Description |
|---|---|---|
| `markLessonComplete(FormData)` | lessonId, childId, gradeType, grade, passFail, notes | Creates completion record; respects permission level (kids go to approval queue) |
| `markLessonIncomplete(id, childId)` | Two UUIDs | Removes completion, resets status to planned |
| `updateGrade(FormData)` | completionId, grade, notes | Updates existing grade |
| `copyCompletionsToChild(currId, sourceId, targetId)` | Three UUIDs | Copies all completions from one child to another for a shared curriculum |

### Server Actions — Scheduling

| Action | Input | Description |
|---|---|---|
| `setAssignmentDays(assignmentId, weekdays)` | UUID + number[] | Sets custom weekday schedule for an assignment |
| `autoScheduleLessons(currId, childId)` | Two UUIDs | Assigns dates to unscheduled lessons respecting school days and overrides |
| `clearSchedule(currId)` | UUID | Nulls all planned dates for non-completed lessons |
| `rescheduleAllLessons(currId, childId)` | Two UUIDs | Clears then re-schedules from scratch |
| `bumpOverdueLessons(childId, today)` | UUID + date | Shifts overdue lessons forward to next valid school dates |

### Pages

**`/curricula`** — Grid of curriculum cards with subject color, child name, cover image, lesson count, and completion progress. Supports gallery/table view toggle, child filter, and search.

**`/curricula/[id]/board`** — Kanban board grouped by section. Cards show title, status, date, resource thumbnails, and per-child completion avatars. Drag-and-drop reordering. Click to open CardViewModal with markdown content and inline video preview.

**`/curricula/[id]/list`** — List view with filter tabs (All/Incomplete/Completed), multi-select bulk actions, schedule configuration panel, and completion copy banner for shared curricula.

**`/lessons`** — Flat table of all lessons across curricula.

**`/lessons/[id]`** — Lesson detail with markdown description, completion form (grade/pass-fail/notes), and resource manager for attaching/removing resources.

**`/lessons/table`** — Spreadsheet-style editable table using TanStack React Table. Inline editing for title, status, and date. Bulk actions for date/status/delete. Resource attachment to multiple selected lessons.

### Key Behaviors

- **Scheduling algorithm** — `autoScheduleLessons` walks forward from today (or school year start), skipping non-school days, date overrides, and dates that already have a lesson scheduled for that curriculum, assigning one lesson per valid open day. Custom assignment days take priority over school year defaults.
- **Completion cascading** — When a lesson is completed ahead of schedule, `shiftLessonsAfterCompletion` shifts remaining incomplete lessons forward to fill the gap.
- **Bump overdue** — `bumpOverdueLessons` finds overdue lessons per-curriculum and shifts them to the next valid dates. Can be triggered per-child or for all children.
- **Completion copying** — When a curriculum is shared between children and one has more completions, `CompletionCopyBanner` detects the mismatch and offers one-click copying.
- **Permission-aware completions** — Kid users with `mark_complete` permission create pending completions that require parent approval. Full-permission users complete immediately.
- **Lesson status is shared** — `lesson.status` is a single field, not per-child. Marking complete for one child sets it to `completed` for all. This is a known limitation (see Future Scope).
- **Prepped toggle** — The curriculum edit modal includes a checkbox to toggle the `prepped` boolean. This is a purely organizational aid with no functional side effects; it indicates that all planning and prep for the course is complete.
- **Drag-and-drop** — Uses `@dnd-kit` for board card reordering. On drop, all affected cards get updated `order_index` and `section` values via `reorderLessons`.
- **Actual start/end dates** — `actual_start_date` is auto-set on the first lesson completion for a curriculum; `actual_end_date` is auto-set when all lessons are completed. Displayed on board, list, and edit views.
- **Curriculum tags** — Curricula can be tagged via the `curriculum_tags` junction table, extending the tag system beyond resources.
- **Lesson tags** — Individual lessons can be tagged via the `lesson_tags` junction table.
- **Course-to-lesson resource flow** — When editing a lesson, a checklist shows the parent curriculum's resources for easy selection rather than searching the global library.
- **Combo grade type** — `grade_type = 'combo'` allows per-lesson grade mode (numeric or pass/fail) within a single curriculum.
- **Interactive checklists** — Lesson descriptions can contain checklist items that are toggleable in the UI, allowing sub-tasks to be checked off as completed.
- **Checklist progress indicator** — Board and week cards display checklist completion counts (e.g. "3/5 items done").

### Data Flow

```
subjects (global)
  +-- curricula ---- curriculum_assignments ---- children
       |                    |
       +-- lessons          +-- curriculum_assignment_days
            |                    (per-child weekday schedule)
            |-- lesson_resources ---- resources (global)
            +-- lesson_completions (per-child)
```

---

## Feature 4: Week Planner

### Summary

The Week Planner is the primary daily-use view for managing homeschool scheduling. It presents a multi-week grid of lessons organized by child, day, and subject, with inline completion checkboxes, drag-and-drop rescheduling, and embedded resource previews. It uses a three-level drill-down: week board -> daily subject list -> individual lesson cards.

### Goals

- Provide a clear at-a-glance view of what's scheduled each day per child
- Enable quick lesson completion without leaving the planner
- Support rescheduling via drag-and-drop (desktop and mobile)
- Show external events alongside lessons for a complete daily picture

### Out of Scope

- Print-friendly weekly schedule layout
- Time-of-day scheduling (lessons are date-based, not time-based)

### Future Scope

- **Drag-and-drop between children** — Reassign a lesson from one child to another via drag

### Route Structure

```
/week                                    -> Redirect to current week + first child
/week/[weekStart]                        -> Main board (6-week grid)
/week/[weekStart]/[date]                 -> Daily subject list for one day
/week/[weekStart]/[date]/[subjectId]     -> Lesson cards for a subject on a day
```

`weekStart` is an ISO date (e.g. `2026-02-23`) for the Monday of the displayed week. Child is encoded as `?child={id}` or `?child=all`.

### Pages

**Level 1 — Main Board** (`/week/[weekStart]`)

The core view. Displays 6 consecutive weeks as labeled sections, each with a 7-column day grid (2-col on mobile). Each day cell shows:
- External events as dashed-border badges (school emoji, color dot, title, time range)
- Lessons grouped by subject -> course, with completion checkboxes, status dots, and links
- Today's cell is highlighted with a colored border

On page load, `bumpOverdueLessons` is called to shift any overdue lessons forward.

**Level 2 — Daily Subjects** (`/week/[weekStart]/[date]`)

Card grid (2-col mobile, 3-col desktop) showing one card per subject for that day. Each card displays subject name with color dot, lesson list with completion status, count, and progress bar. Completed subjects get a green tint. Cards link to Level 3.

**Level 3 — Subject Lessons** (`/week/[weekStart]/[date]/[subjectId]`)

Full lesson detail cards with: completion checkbox, title, curriculum link, description, grade, completion notes, inline resource embeds (YouTube iframe, PDF link), and reschedule button.

### Key Behaviors

- **Child selection** — Dropdown in the layout (shown when 2+ children). "All Kids" groups lessons by "ChildName - Subject" to keep them separate. Selection persists across navigation via URL param.
- **Week navigation** — Prev/next arrows and a "Today" button. All client-side navigation preserving the child param.
- **Drag-and-drop rescheduling** — Desktop: standard HTML drag events. Mobile: long-press (220ms) activates touch drag using `document.elementFromPoint`. Both call `rescheduleLesson` server action with optimistic local updates and rollback on error.
- **Auto-bump overdue** — On every board render, overdue planned lessons are automatically shifted to the next valid school day based on school day config and date overrides.
- **Inline completion** — Checkbox toggles `markLessonComplete` / `markLessonIncomplete` via `useTransition`. Respects permission levels (kid users create pending completions).
- **Resource embeds** — YouTube resources render as privacy-friendly `youtube-nocookie.com` iframes. PDFs render as styled links with page numbers. Other types render as generic links.
- **Filtering** — Subject and course dropdowns filter the board client-side. Subject selection cascades to filter the course list. "Clear filters" resets both.
- **External events** — Fetched alongside lessons and displayed at the top of each day cell. Scoped by child (or all children for the parent). Include color dot, title, and time range. Shown at all drill-down levels (board, daily subjects, and subject lessons).
- **Inline lesson detail modal** — Clicking a lesson in the week grid opens a modal overlay showing full lesson detail (title, description, resources, completion form) without page navigation.
- **Bump notification banner** — Displays the count of auto-bumped overdue lessons in a visible banner after the bump runs.
- **Weekly summary/notes** — A per-week notes field for the parent to jot down reflections or plans, stored via `weekly-notes` server actions.
- **Checklist progress indicator** — Lesson cards in the week view display checklist completion counts when the lesson has checklist items.

### Queries

| Query | Returns | Used At |
|---|---|---|
| `getWeekLessons(childId, start, end)` | Lessons for one child in date range (no resources) | Level 1, Level 2 |
| `getAllWeekLessons(start, end)` | Lessons for all children (includes child_name) | Level 1 when child=all |
| `getDaySubjectLessons(childId, date, subjectId)` | Full lesson detail with resources and completions | Level 3 |
| `getExternalEventOccurrencesForRange(start, end, childId?, parentId?)` | External events in date range | Level 1 |

---

## Feature 5: Grades & Reports

### Summary

Grades, Reports, and Completed Lessons are three related read-heavy views that aggregate lesson completion data. The Grades page provides an inline-editable gradebook. The Reports page shows household and per-student progress summaries with CSS-only charts. The Completed page provides a filterable, printable history of all finished work.

### Goals

- Provide a gradebook with inline editing for quick grade entry
- Generate per-child progress reports with subject breakdowns
- Maintain a searchable, printable record of all completed work
- Support both numeric grades and pass/fail tracking

### Out of Scope

- GPA calculation or weighted grade formulas
- Grade import from external systems

### Future Scope

- **Weighted grades** — Support assignment weighting within a curriculum (e.g. tests worth more than homework)

### Pages

**`/grades`** — Gradebook

- Summary cards per child showing per-subject average grades with color dots and **letter grade badges** from the default grading scale
- **Grade trends chart** via `GradeTrendsChart` — per-subject sparkline charts showing grade trajectory over time
  - Inline SVG with polyline trend lines and circle data points, colored by subject
  - Hover tooltips showing lesson title, grade, and date
  - Student filter dropdown when multiple children exist
  - Grouped by child, with responsive 2-column grid layout
  - Data from `getGradeTrends()` query in `lib/queries/grades.ts`
- Full grades table via `GradesTableClient` with inline editing
- **Table columns:** Student, Lesson (linked), Subject (badge, linked), Grade (editable), Notes (editable), Date
- **Grade color coding:** green (90+), blue (80-89), amber (70-79), red (<70)
- **Letter grade badges** next to numeric grades, derived from the default grading scale thresholds
- "Grading Scales" link in page header navigates to `/settings` for configuration
- Inline editing calls `updateGrade` server action, then refreshes
- No pagination, sorting, or filtering currently

**`/settings`** — Settings (includes Grading Scales)

- **Grading scale editor** via `GradingScaleEditor` client component
- Lists all grading scales; each shows threshold badges (letter: min_score+)
- Default scale marked with star icon; click star on any scale to set as default
- Edit mode: inline editing of scale name, threshold letters, min scores, and colors
- Create new scales with pre-populated default thresholds (A/B/C/D/F)
- Delete scales (disabled for default scale)
- Default "Standard" scale seeded on migration: A (90+), B (80+), C (70+), D (60+), F (0+)

**`/reports`** — Progress Reports

- Student selector (clickable links with completion percentage)
- Overall household progress: completion %, completed count, in-progress count, performance feedback text
- Per-student detail (when selected):
  - Subject breakdown with colored progress bars
  - Grade averages by subject as CSS-only bar chart
  - Numeric courses section with avg grade and progress
  - Pass/fail courses section with pass/fail counts
- Grade insights card: average grade, recorded count, grade band distribution (Excellent/Strong/Developing/Needs Support)

**`/completed`** — Completed Work History

- **5 filter controls:** Student, School Year, Subject, Date From, Date To — all URL-param-driven with server-side filtering
- Results grouped 3 levels deep: Child -> Week (newest first) -> Subject
- Each lesson shows: title, curriculum name, grade badge, notes
- **Print mode:** Filters hidden, print-only header with scope summary
- "Print / Save PDF" button triggers `window.print()`

### Key Behaviors

- **Inline grade editing** — Click a grade or notes cell to edit in place. Saves via `updateGrade(completionId, grade, notes)`. Grade validated 0-100 with up to 2 decimal places.
- **Grade summary per child** — Aggregated per subject: average, min, max, count. Min/max are queried but not displayed yet.
- **Performance feedback** — Automated text based on completion percentage: "Excellent" (85%+), "Solid" (65%+), "Making progress" (40%+), "Early-stage" (<40%).
- **Print-friendly completed view** — CSS print rules hide navigation, filters, and summary. Print header shows report scope. Grid switches to 2-column for paper layout.
- **Server-side filtering** — Completed page builds dynamic SQL WHERE clause from URL params. All filters are optional and combinable.
- **School year filter on reports** — Year selector on the reports page allows reviewing progress for any school year, not just the active one.
- **Exportable PDF report cards** — Per-child PDF report card generation via pdfkit (`/api/reports/export`). Includes subject breakdown, grade averages, and completion stats for record-keeping or submission to school districts.
- **Custom grading scales** — Configurable letter grade thresholds via `/settings`. Tables: `grading_scales` (name, is_default) and `grade_thresholds` (scale_id, letter, min_score, color). Default scale's thresholds are used to display letter grade badges on the grades page. Server actions in `lib/actions/grades.ts` (CRUD, set default). Utility function `getLetterGrade()` in `lib/utils/grading.ts` maps numeric grades to letters.

---

## Feature 6: Calendar

### Summary

The Calendar provides a monthly view of scheduled lessons and external events, with day-level drill-down, inline lesson completion, and the ability to create lessons, curricula, and subjects without leaving the calendar. It also supports iCal export for syncing with external calendar apps. School year configuration (school days, holidays, overrides) controls which dates are valid for scheduling.

### Goals

- Monthly overview of all scheduled lessons and external events per child
- Quick lesson completion from the calendar view
- Inline creation of lessons, curricula, and subjects
- iCal export for external calendar integration
- Configurable school year calendar (school days, holidays, makeup days)

### Out of Scope

- Time-of-day scheduling (all lessons are date-level, not time-level)
- Recurring lesson display (handled by individual lesson records)
- Two-way calendar sync (iCal is export-only; see Radicale in Integrations)

### Future Scope

- **Drag-and-drop rescheduling on calendar** — Move lessons between days by dragging on the monthly grid
- **Multi-month or semester view** — Zoomed-out view showing completion density across months
- **Improved day detail modal** — Denser day cells with a quick-access centered overlay for day detail

### Architecture

The calendar uses a server/client split:
- **Server component** (`page.tsx`) — fetches children list, determines role-based access
- **Client component** (`CalendarView.tsx`) — owns all interactive state, fetches lesson data via API

Lesson data is fetched client-side from `GET /api/calendar` rather than server-side queries, enabling month navigation without full page reloads.

### API Endpoints

**GET /api/calendar**

| Param | Type | Description |
|---|---|---|
| year | number | Required — calendar year |
| month | number | Required — month (1-12) |
| childId | UUID | Optional — filter to one child |
| viewMode | string | `planned` (default), `completed`, or `all` |

Returns `{ lessons, externalEvents }` for the requested month. Auth-enforced: kid users are locked to their own child.

**GET /api/calendar/ical**

| Param | Type | Description |
|---|---|---|
| kid | string | Optional — filter by child name |
| token | string | Required if `ICAL_TOKEN` env var is set |

Returns RFC 5545 iCalendar file with future non-completed lessons as all-day events. Each event includes subject name, lesson title, child name, curriculum, and two reminders (1 day and 30 minutes before).

### Calendar Grid

Standard 7-column grid (Sun-Sat). Each day cell shows:
- Day number (today highlighted with ring)
- Up to 1 external event (color dot + school emoji)
- All subject indicators (color dots) for scheduled lessons — no limit, compact layout that scales

Clicking a day opens a **Day Detail Modal** grouping lessons by Subject -> Curriculum. Each lesson is clickable to open the full Lesson Detail Modal.

### Modals

**Lesson Detail Modal** — Read-only lesson view with subject, curriculum, status, date, description, and resources. Resources open in `ResourcePreviewModal` (YouTube inline player, etc.). "Mark Complete" button (always available). "Edit" button (parent only).

**Lesson Form Modal** — Create/edit lesson with cascading selects: Subject -> Curriculum -> Title/Description/Date. Includes "New Subject" and "New Curriculum" inline creation buttons that open their respective modals and auto-select the new item on return.

**Subject Form Modal** — Name + color picker (10 presets).

**Curriculum Form Modal** — Name + description + course type (Course or Unit Study).

### School Year Configuration

Managed via admin panel (`/admin/calendar`). Controls which dates are valid for lesson scheduling.

**Server Actions:**

| Action | Description |
|---|---|
| `createSchoolYear(FormData)` | Creates year with label and date range; auto-adds Mon-Fri as defaults |
| `updateSchoolYear(FormData)` | Updates label and dates |
| `deleteSchoolYear(id)` | Cascading delete |
| `setSchoolDays(yearId, weekdays[])` | Replaces school day configuration; triggers lesson reflow |
| `addDateOverride(FormData)` | Adds holiday (exclude) or makeup day (include) for a specific date |
| `removeDateOverride(id)` | Removes an override |

**Lesson Reflow** — When school days change, all planned lessons for the year are automatically repositioned to land on valid school dates, preserving their relative order.

### Role-Based Access

| Capability | Parent | Kid |
|---|---|---|
| View calendar | All children or filtered | Own child only |
| Mark complete | Yes | Yes |
| Edit / create lessons | Yes | No |
| Create subjects / curricula | Yes | No |
| iCal export | Via token URL | Via token URL |

---

## Feature 7: Resources & Tags

### Summary

Resources are a global library of learning materials — books, videos, PDFs, links, and supplies — that can be attached to curricula and individual lessons. Tags provide a flat categorization system for resources. The system supports two tiers: global library resources (with full metadata, tags, and multi-lesson attachment) and inline-only lesson resources (simple URL references without library membership).

### Goals

- Maintain a searchable, taggable library of learning resources
- Attach resources at both the curriculum level (e.g. a textbook for the whole course) and the lesson level (e.g. a specific video for one lesson)
- Support inline previews for YouTube videos and images
- Provide tag management with rename, merge, and filter capabilities

### Out of Scope

- File hosting (resources are URLs or references, not uploaded files — except thumbnails)
- Resource reviews or ratings
- Resource sharing between Harmony instances

### Future Scope

- **Resource usage analytics** — Track which resources are most/least used across curricula
- **Asset vs resource separation** — Clearly distinguish between app assets (uploaded images for display purposes) and learning resources (materials used in instruction). Assets should have their own storage and management path, never appearing in the global resource library.
- **Resource type: "local file"** — If local file attachments (worksheets, printables) need to be treated as resources, add a distinct `local_file` type so they can be filtered separately from external URLs.

### Data Model

**resources**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| title | TEXT | Resource name, required |
| type | TEXT | `book`, `video`, `pdf`, `link`, or `supply` |
| author | TEXT (nullable) | Author name (primarily for books) |
| url | TEXT (nullable) | Resource URL |
| thumbnail_url | TEXT (nullable) | Cover image / thumbnail path |
| description | TEXT (nullable) | Notes / description |
| created_at | TIMESTAMPTZ | Auto-set |

**lesson_resources** (per-lesson attachment)

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| lesson_id | UUID | Foreign key to lessons |
| resource_id | UUID (nullable) | Foreign key to resources; NULL = inline-only |
| type | TEXT | `youtube`, `pdf`, `filerun`, or `url` |
| url | TEXT | Resource URL, required |
| title | TEXT (nullable) | Display title |
| thumbnail_url | TEXT (nullable) | Preview image |
| page_number | INTEGER (nullable) | Specific page reference |

Note: `lesson_resources.type` uses a different enum than `resources.type`. Mapping: `video` -> `youtube`, otherwise pass-through.

**curriculum_resources** (course-level attachment)

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| curriculum_id | UUID | Foreign key to curricula |
| resource_id | UUID | Foreign key to resources |
| notes | TEXT (nullable) | How the resource is used in this course |
| created_at | TIMESTAMPTZ | Auto-set |

Unique on (curriculum_id, resource_id).

**tags**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | Tag name, unique, stored lowercase |
| created_at | TIMESTAMPTZ | Auto-set |

**resource_tags** (junction)

| Field | Type | Description |
|---|---|---|
| resource_id | UUID | Foreign key to resources |
| tag_id | UUID | Foreign key to tags |
| created_at | TIMESTAMPTZ | Auto-set |

Composite primary key on (resource_id, tag_id).

### Server Actions — Resources

| Action | Description |
|---|---|
| `createGlobalResource(FormData)` | Creates library resource with tags, booklist links, and optional OpenLibrary cover auto-fetch for books |
| `updateGlobalResource(FormData)` | Updates resource; supports thumbnail upload/clear and tag/booklist sync |
| `deleteGlobalResource(id)` | Soft-unlinks from lessons (nulls resource_id), then deletes resource row |
| `bulkDeleteResources(ids)` | Same unlink-then-delete for multiple resources |
| `attachResourceToLessons(resourceId, lessonIds)` | Links a global resource to one or more lessons |
| `detachResourceFromLesson(resourceId, lessonId)` | Removes a specific lesson-resource link |
| `attachResourceToCurriculum(resourceId, curriculumId, notes?)` | Links resource at curriculum level |
| `detachResourceFromCurriculum(resourceId, curriculumId)` | Removes curriculum-resource link |
| `addResource(FormData)` | Adds an inline-only lesson_resource (no global record) |
| `replaceLessonResources(input)` | Replaces all lesson_resources for a lesson in one transaction |
| `bulkAddSuppliesToLesson(lessonId, lines)` | Creates supply-type resources from newline-separated text |

### Server Actions — Tags

| Action | Description |
|---|---|
| `createTag(name)` | Creates tag (lowercased, upsert) |
| `renameTag(tagId, newName)` | Renames a tag |
| `deleteTag(tagId)` | Hard deletes tag; cascades through resource_tags |
| `mergeTags(sourceId, targetId)` | Moves all source tag's resource associations to target, then deletes source |

### Pages

**`/resources`** — Library list with:
- Text search (title/description/author), type checkboxes with select all/deselect all, tag filter
- Gallery and table view toggle (persisted to localStorage)
- Bulk select with bulk delete (warns about lesson usage)
- Table columns: title (with inline image), type badge, usage count, date, actions
- Gallery: thumbnail cards with type badge, title, description excerpt, usage count
- "+ New Resource" modal: title, type, author (books only), URL, thumbnail upload (books only), description

**`/resources/[id]`** — Resource detail with:
- Thumbnail preview, type badge, URL with inline preview button, author, notes, tag pills, date
- "Used in Lessons" panel listing all linked lessons with detach buttons
- "Attach to Lessons" modal with multi-select search
- Edit modal: full fields plus TagInput with autocomplete, booklist checkboxes (books only), cover photo upload/clear

**`/tags`** — Tag management:
- Parent view: table with tag name (colored pill, linked to filtered resources), resource count, inline rename, merge dropdown, delete
- Kid view: read-only card grid linking to filtered resources
- Text filter and "New Tag" inline form (parent only)

### Key Behaviors

- **Two-tier system** — Global library resources have full metadata, tags, and multi-lesson attachment. Inline-only resources (resource_id = NULL) are simple URL references tied to a single lesson.
- **Soft delete preservation** — Deleting a global resource nulls the `resource_id` on lesson_resources rather than deleting them, so lessons retain the URL as an orphaned inline reference.
- **Author auto-tagging** — Creating a book resource automatically merges the author name into the tag list.
- **OpenLibrary cover fetch** — On book creation without a thumbnail, the system queries OpenLibrary's search API for a cover image.
- **YouTube enrichment** — Adding a YouTube URL auto-fetches title and thumbnail via oembed.
- **Tag merge is destructive** — Merging moves all resource associations from source to target, then deletes the source tag.
- **Inline preview** — `ResourcePreviewModal` renders YouTube videos as `youtube-nocookie.com` iframes, images as thumbnails, and other types as "no preview" with an external link.
- **Local uploads are not resources** — Uploaded images (curriculum cover photos, subject thumbnails, child banners) are local app assets stored under `/uploads/`. These should NOT appear in the Resources library. Resources are intentional learning materials: books, supplies, external links, videos, and PDFs that the parent plans to use for instruction.
- **Tags extended to curricula and lessons** — Tags apply to resources (via `resource_tags`), curricula (via `curriculum_tags`), and lessons (via `lesson_tags`).
- **Course-to-lesson resource flow** — When editing a lesson, a checklist of the parent curriculum's resources is shown for easy selection instead of searching the global library.
- **Bulk tag assignment** — Tags can be applied to multiple selected resources at once from the list view.
- **Promote inline to global** — Inline-only lesson resources can be converted into full library resources with one click.

---

## Feature 8: Booklists

### Summary

Booklists are named collections of book-type resources, displayed as a kanban-style horizontal board. Books can be dragged between lists. Each child automatically gets a personal wishlist. Parents can create shared lists manually or by auto-populating from tags. Booklists are independent of the curriculum/lesson hierarchy — they're a standalone organizational layer for tracking reading materials.

### Goals

- Organize books into named reading lists
- Give each child a personal wishlist they can add to
- Support drag-and-drop between lists
- Auto-populate lists from tag-based queries

### Out of Scope

- Book reviews or ratings
- Integration with library catalog systems

### Future Scope

- **Book recommendations** — Suggest books based on current subjects or tags
- **Booklist sharing/export** — Export a booklist as a printable reading list or share between Harmony instances

### Data Model

**booklists**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| name | TEXT | List name, required |
| owner_child_id | UUID (nullable) | Foreign key to children; set = personal wishlist, null = shared list |
| description | TEXT (nullable) | Optional description |
| created_at | TIMESTAMPTZ | Auto-set |

No school year scoping — lists are global and persist across years.

**booklist_resources** (junction)

| Field | Type | Description |
|---|---|---|
| booklist_id | UUID | Foreign key to booklists |
| resource_id | UUID | Foreign key to resources |
| position | INTEGER | Sort order within the list, default 0 |
| created_at | TIMESTAMPTZ | Auto-set |

Composite primary key on (booklist_id, resource_id). Only `type = 'book'` resources allowed (enforced at action layer).

### Server Actions

| Action | Description |
|---|---|
| `createBooklist(FormData)` | Parent-only. Creates list with name, description, and initial book selection |
| `createBooklistFromTags(name, tags[], description?)` | Creates list auto-populated with all books matching any of the given tags |
| `updateBooklist(FormData)` | Parent-only. Updates name/description and fully replaces book membership |
| `deleteBooklist(id)` | Parent-only. Hard deletes list (books themselves are not deleted) |
| `addBookToBooklist(booklistId, resourceId)` | Adds a book to a list (upsert). Kids restricted to their own wishlist |
| `addBookToPersonalWishlist(title, author)` | Kid-only. Creates a new book resource, auto-fetches OpenLibrary cover, auto-tags with author, and adds to child's wishlist |

### Pages

**`/booklists`** — Kanban board layout:
- Horizontal scrollable columns, one per booklist plus an "Unassigned" column
- Books rendered as cards with thumbnail (or emoji placeholder), title, author, and up to 3 tag pills
- Drag-and-drop books between columns
- Parent controls: New Booklist modal (manual selection or from tags), Add Book modal (creates global resource), Edit/Delete per list
- Kid controls: inline "Add to your wishlist" form (title + author)
- Kid users auto-get a personal wishlist on page load

### Key Behaviors

- **Auto-created wishlists** — On page load, if the user is a kid, `ensureChildWishlist` creates a "[Name] wants to read..." list if one doesn't exist.
- **Book-only enforcement** — Only resources with `type = 'book'` can be added to booklists. Validated at the action layer, not the database.
- **Create from tags** — Parent can select tags, see a live count of matching books, and auto-populate a new list with all matches.
- **OpenLibrary auto-cover** — When kids add books via wishlist, the system auto-fetches a cover image from OpenLibrary's search API.
- **Drag-and-drop** — Books are draggable between columns. Kids can only drop onto their own wishlist. Uses HTML5 drag events.
- **Curriculum-linked booklists** — Booklists can be assigned to a curriculum as supplemental reading lists. The booklist appears on the curriculum view (board and list). A single booklist can be linked to multiple curricula.
- **Bulk booklist import** — Import a list of books from a pasted text list, CSV, or external curriculum catalog for quick population of reading lists.
- **Reading log** — Tracks pages read and time spent per book per child via the `reading_log` table. Accessible at `/reading` with a dedicated `ReadingLogClient` component. Server actions in `lib/actions/reading.ts` and queries in `lib/queries/reading.ts`.

---

## Feature 9: External Events

### Summary

External Events track non-lesson activities — co-ops, sports, classes, tutoring — that appear on the week planner, dashboard, and calendar alongside lessons. Events support recurrence (weekly, biweekly, monthly, or one-time) and are assigned to one or more children. The creation flow is import-first: paste a list of dates and the system auto-detects the recurrence pattern and infers exception dates from gaps.

### Goals

- Track recurring external activities alongside lesson schedules
- Auto-detect recurrence patterns from pasted date lists
- Show events on all scheduling views (week, dashboard, calendar)
- Support per-date exceptions (holidays, cancellations)

### Out of Scope

- Cost/fee tracking for external activities
- Attendance tracking
- Integration with external scheduling systems (Google Calendar, etc.)

### Future Scope

- **Two-way calendar sync** — Sync external events with Google Calendar, Apple Calendar, or CalDAV
- **Event notes per occurrence** — Add notes to a specific date's occurrence (e.g. "field trip today") without affecting the series
- **Travel time / location** — Add location and estimated travel time to help with daily planning

### Data Model

**external_events**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| title | TEXT | Event name, required |
| description | TEXT (nullable) | Optional description |
| recurrence_type | TEXT | `once`, `weekly`, `biweekly`, or `monthly` |
| day_of_week | INTEGER (nullable) | 0 (Sun) through 6 (Sat); used for weekly/biweekly |
| start_date | DATE | First occurrence date |
| end_date | DATE (nullable) | Last occurrence date; NULL = open-ended |
| start_time | TIME (nullable) | Event start time |
| end_time | TIME (nullable) | Event end time |
| all_day | BOOLEAN | Default false |
| color | TEXT | Hex color code, default `#3b82f6` |
| category | TEXT (nullable) | Event category: `co-op`, `sport`, `music`, `art`, `field-trip`, or `other` |
| created_at | TIMESTAMPTZ | Auto-set |

**external_event_children** (junction)

| Field | Type | Description |
|---|---|---|
| external_event_id | UUID | Foreign key to external_events |
| child_id | UUID | Foreign key to children |

Composite primary key. Cascading deletes.

**external_event_exceptions**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| external_event_id | UUID | Foreign key to external_events |
| exception_date | DATE | Skipped date |
| reason | TEXT (nullable) | e.g. "Holiday/Break" |
| created_at | TIMESTAMPTZ | Auto-set |

Unique on (external_event_id, exception_date).

### Server Actions

| Action | Description |
|---|---|
| `createExternalEvent(FormData)` | Creates event from pasted dates; auto-detects recurrence and infers exceptions from gaps |
| `updateExternalEvent(FormData)` | Updates event with direct recurrence field editing; replaces children and exceptions |
| `deleteExternalEvent(id)` | Hard deletes event with cascading cleanup |
| `previewImportedExternalDates(raw)` | Preview import detection results before submitting |

All actions are parent-only (kid role blocked).

### Recurrence Logic

**Import detection** (`parseImportedDates`):
1. Parses flexible date formats (YYYY-MM-DD, M/D/YYYY, natural language)
2. Auto-detects pattern from gaps and weekday consistency:
   - 1 date -> `once`
   - Same weekday, 14-day gaps -> `biweekly`
   - Same weekday, 7-day gaps -> `weekly`
   - Same day-of-month -> `monthly`
3. Infers exception dates from gaps in the expected pattern

**Runtime expansion** (`expandExternalEventOccurrences`):
- Stored recurrence rules are expanded into concrete date occurrences at query time
- No pre-materialized occurrence rows in the database
- Exception dates checked via O(1) Set lookup during expansion

### Pages

**`/admin/external-events`** — Admin-only management page:
- Event cards showing color dot, title, recurrence label, date range, time, assigned children, exception count
- **Create modal:** Title, description, child checkboxes, time/color, paste dates textarea (required). Live preview shows detected recurrence, date range, date count, and implied exception count.
- **Edit modal:** Direct editing of all recurrence fields (no paste import). Exception dates as newline-separated text with a shared reason field.

### Cross-View Integration

| View | How Events Appear |
|---|---|
| **Week Planner** | Dashed-border badges at top of each day cell with color dot, school emoji, title, time range |
| **Dashboard** | Per-child per-day alongside upcoming lessons in the due-soon grid |
| **Calendar** | Included in the API response and rendered on calendar day cells |

Events are always scoped by child (or all children for parent view) and filtered to the displayed date range.

- **Event categories** — Events can be categorized by type (`co-op`, `sport`, `music`, `art`, `field-trip`, `other`) for filtering and reporting.

---

## Feature 10: Authentication & Users

### Summary

Authentication uses NextAuth with JWT sessions and a credentials provider (email + password). Two user roles exist: parent (full admin) and kid (restricted, linked to a specific child). Kid accounts have configurable permission levels that control what actions they can take. The system is intentionally lightweight — designed for a single-family self-hosted setup, not multi-tenant.

### Goals

- Secure access with email/password authentication
- Support parent and kid roles with appropriate access restrictions
- Allow parents to create and manage kid accounts
- Enforce ownership so kids can only see their own data

### Out of Scope

- OAuth / social login
- Multi-family / multi-tenant support
- Email verification

### Future Scope

(No remaining items — all previously scoped items have been implemented.)

### Data Model

**users**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| email | TEXT | Unique, required |
| password_hash | TEXT | Bcrypt hash, required |
| name | TEXT (nullable) | Display name |
| role | TEXT | `parent` or `kid`, default `parent` |
| child_id | UUID (nullable) | Foreign key to children; set for kid accounts |
| permission_level | TEXT | `full`, `mark_complete`, or `view_only`, default `full` |
| created_at | TIMESTAMPTZ | Auto-set |

**pending_completions**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| lesson_id | UUID | Foreign key to lessons |
| child_id | UUID | Foreign key to children |
| submitted_by | UUID (nullable) | Foreign key to users |
| notes | TEXT (nullable) | Completion notes |
| grade | NUMERIC(5,2) (nullable) | Submitted grade |
| created_at | TIMESTAMPTZ | Auto-set |

Unique on (lesson_id, child_id).

### Permission Levels

| Level | Can Edit | Can Mark Complete | Can View |
|---|---|---|---|
| `full` | Yes | Yes | Yes |
| `mark_complete` | No | Yes (creates pending approval) | Yes |
| `view_only` | No | No | Yes |

Parents always have `full` permission. These levels primarily affect kid accounts.

### Session Structure (JWT)

```
{ id, email, name, role, childId, permissionLevel }
```

No database sessions — JWT only. Token carries all role/permission data to avoid per-request DB lookups.

### Server Actions

| Action | Description |
|---|---|
| `signupUser(FormData)` | Creates parent account (email, password min 8 chars, name) |
| `createKidAccount(FormData)` | Parent-only. Creates kid account linked to a child record |
| `updateEmail(FormData)` | Requires current password re-verification |
| `updatePassword(FormData)` | Requires current password, new password min 8 chars |
| `deleteKidAccount(userId)` | Parent-only. Refuses to delete parent accounts |

### Route Protection (Middleware)

All routes require a valid JWT except: `/login`, `/signup`, `/api/auth/*`, static assets, and `/uploads`.

**Kid route restrictions** — Kid users can only access:
- `/dashboard`, `/calendar`, `/booklists`, `/login`
- `/lessons/*`, `/api/calendar`, `/api/lessons`, `/api/auth`
- All other paths redirect to `/dashboard`

### Pages

**`/login`** — Email + password form. Generic error message ("Invalid email or password"). Redirects to `/dashboard` on success.

**`/signup`** — Name + email + password + confirm. Creates parent account and auto-logs in.

**`/settings/account`** — Change email (requires current password) and change password forms. Accessible to all roles.

**`/settings/users`** — Parent-only. Create kid accounts (email, password, linked child). List existing kid accounts with delete buttons.

### Key Behaviors

- **Child scope enforcement** — Kid users are locked to their own `child_id` for all data queries. Parent users can access any child they own via `parent_children`.
- **Pending completion workflow** — When a kid with `mark_complete` permission marks a lesson complete, it goes into `pending_completions` for parent approval rather than being recorded immediately.
- **Auth bypass** — Currently the landing page redirects straight to `/dashboard`, so login is only triggered when the JWT expires or is absent.
- **Bcrypt hashing** — All passwords hashed with bcrypt. No plain-text storage.
- **Permission level UI** — Kid account creation and editing forms include a permission level selector (`full`, `mark_complete`, `view_only`).
- **Password reset for kid accounts** — Parents can reset kid account passwords from the user management UI.
- **Parent ownership enforcement on delete** — Deleting a kid account verifies parent ownership via `parent_children` before proceeding.
- **Dedicated approvals page** — `/approvals` provides a dedicated page for reviewing and approving pending completions submitted by kid accounts, beyond the dashboard widget.

---

## Feature 11: Admin

### Summary

The Admin panel provides power-user tools for configuration, bulk operations, and imports that go beyond day-to-day content management. It includes student CRUD, bulk lesson import (paste-based and Trello), school year calendar configuration, external event management, and tag lifecycle management. Regular sidebar pages are for daily use; admin is for setup, imports, and system configuration.

### Goals

- Centralize system configuration (school years, schedules, holidays)
- Enable bulk data entry (paste lessons, import from Trello)
- Provide full CRUD for students (photos, profiles)
- Surface diagnostic tools (schedule exceptions)

### Out of Scope

- Multi-user admin roles (single admin level)
- Audit logging of admin actions

### Future Scope

- **Bulk resource import** — Import resources (books, links) from a pasted list or CSV, not just via Trello
- **Admin dashboard** — Richer analytics: completion trends, time-to-complete, subject balance across children
- **Import from other homeschool platforms** — Import lesson plans from common homeschool planning tools beyond Trello

### Admin Hub (`/admin`)

Landing page with links to all tools. Displays aggregate stats: student count, subject count, curriculum count, lesson count. Banner clarifies that daily management (subjects, curricula, lessons) lives in the sidebar — admin is for calendar setup, imports, tag management, and reporting.

### Student Management (`/admin/children`)

Full CRUD for child profiles — the only place to create, edit, or delete students.

- **Create/Edit fields:** name, emoji (30 presets), banner photo (file upload with clear option)
- **Views:** gallery (cards with banner, stats) and table
- **Delete warning:** cascading impact on subjects, curricula, lessons, and completions

### Bulk Lesson Import (`/admin/lessons`)

Paste-based batch lesson creation for loading historical or pre-planned content.

**Input format** (tab or comma delimited):
```
title | date | description | status | result
```

**Workflow:**
1. Select target curriculum (scoped by child + subject)
2. Select children for completion records
3. Select school year (required for completed lessons)
4. Paste rows -> live preview table with inline editing and per-row validation
5. "Create All" fires `bulkCreateLessons` (up to 2000 at once)

Supports importing completed lessons with grades and pass/fail results in a single batch.

### Trello Import (`/admin/trello`)

4-step wizard converting a Trello board into a curriculum with lessons and resources.

1. **Select Board** — fetches accessible boards via Trello API
2. **Configure** — create new or append to existing curriculum; options for title prefixing, completed lesson import, checklist handling (as description markdown or as separate lessons)
3. **Preview** — editable table with include/exclude toggles per card; auto-detects "Resources" and "Credits" lists
4. **Import** — creates curriculum, bulk-creates lessons, attaches extracted resources (YouTube, PDFs, images, URLs from attachments and card descriptions)

Requires `TRELLO_API_KEY` and `TRELLO_TOKEN` environment variables.

### School Calendar (`/admin/calendar`)

Master school year and schedule configuration.

**School Years:** Create/edit/delete with label, start date, end date. Delete warns with lesson count.

**School Days:** Per-year weekday toggles (Sun-Sat). Changes trigger automatic lesson reflow — all planned lessons for the year are repositioned to land on valid school dates.

**Date Overrides:** Per-date holidays (exclude) and makeup days (include) with optional reason text.

**Schedule Exceptions:** Read-only diagnostic table showing any curriculum assignment whose custom weekday schedule differs from the school year default — helps spot configuration drift.

### External Events (`/admin/external-events`)

Covered in Feature 9. Paste-based import with auto-detected recurrence and inferred exception dates.

### Tag Management (`/admin/tags`)

Covered in Feature 7. Full tag lifecycle: create, rename, merge, delete with resource counts.

### What Admin Adds Beyond Regular Pages

| Capability | Regular Pages | Admin |
|---|---|---|
| Student CRUD | Read-only | Create, edit, delete with photos |
| Lesson creation | One at a time | Bulk paste (hundreds), Trello import |
| School year config | None | Full CRUD + weekday schedule |
| Holidays / makeup days | None | Date override system |
| Schedule diagnostics | None | Exception detection table |
| Tag lifecycle | Apply only | Create, rename, merge, delete |
| Data export | None | CSV/JSON export via `/api/export` |

### Key Behaviors

- **Data export** — Export all data (curricula, lessons, grades, completions) as CSV or JSON for backup or migration via `/api/export`.
- **Interactive checklists** — Lesson descriptions support functional, toggleable checklist items. Checklist items can be checked off as they are completed. Works across lesson detail, board, and week views.
- **Checklist progress tracking** — Lesson cards in board and week views display checklist completion counts (e.g. "3/5 items done").

---

## Feature 12: Integrations

### Integration 1: Vikunja Sync (Deprecated — to be replaced by Radicale CalDAV)

#### Summary

Two-way sync between Harmony and a self-hosted Vikunja project. Outbound: pushes upcoming lessons and resources as Vikunja tasks. Inbound: a webhook listens for task completion in Vikunja and marks the corresponding lesson complete in Harmony.

**Deprecation Note:** Vikunja sync is planned for removal. The task mapping table, webhook handler, sync action, and API client add significant complexity for what amounts to "see lessons in another app." A CalDAV integration via self-hosted Radicale will replace it with a standards-based approach that works with any calendar app without custom integration code. The existing iCal export endpoint (`GET /api/calendar/ical`) will serve as the foundation.

#### Configuration

| Env Var | Description |
|---|---|
| `VIKUNJA_URL` | Base URL of Vikunja instance |
| `VIKUNJA_API_TOKEN` | Bearer token for Vikunja REST API |
| `VIKUNJA_PROJECT_ID` | Target Vikunja project ID |
| `VIKUNJA_WEBHOOK_SECRET` | HMAC-SHA256 secret for webhook verification (recommended) |

Feature is disabled entirely if `VIKUNJA_URL` is not set.

#### Data Model

**vikunja_task_map**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| vikunja_task_id | BIGINT | Vikunja's task ID, unique |
| lesson_id | UUID (nullable) | Foreign key to lessons |
| resource_id | UUID (nullable) | Foreign key to resources |
| sync_type | TEXT | `lesson` or `resource` |
| child_id | UUID (nullable) | Foreign key to children |
| created_at | TIMESTAMPTZ | Auto-set |

#### Outbound Sync

Triggered manually via dashboard button. Processes three loops:

1. **Create lesson tasks** — Upcoming 14 days, not completed. Title: `[Subject] Lesson Title (Child)`. Due date from `planned_date`.
2. **Create resource tasks** — Resources linked to upcoming lessons. Title: `[Type] Resource Title`. Due 1 hour before parent lesson.
3. **Clean up completed** — Marks Vikunja tasks as done for lessons completed in Harmony, then removes mapping.

Returns: `{ created, deleted, skipped }`.

#### Inbound Webhook

`POST /api/webhooks/vikunja` — handles `task.updated` events only.

- Task marked done -> creates `lesson_completions` record, sets lesson status to `completed`
- Task unmarked -> deletes completion, resets status to `planned`
- Signature verified via HMAC-SHA256 with `timingSafeEqual`

### Future Integration: Radicale CalDAV (replaces Vikunja)

- **Live subscribable calendars** via CalDAV instead of static iCal file download
- **Per-child calendars** for granular subscriptions
- **Auto-publish on change** — push updates when lessons are created, rescheduled, or completed
- **Two-way completion** — detect when a calendar event is marked done
- **External events included** alongside lessons
- Radicale runs as a separate container in docker-compose

### Integration 2: AI Lesson Suggestions

#### Summary

Uses an LLM to suggest lesson topics for a given subject and curriculum, avoiding duplication of existing lessons. Supports multiple providers through an abstraction layer.

#### Configuration

| Env Var | Default | Description |
|---|---|---|
| `LLM_PROVIDER` | `openai` | `openai`, `openai_compatible`, or `claude` |
| `LLM_API_KEY` | — | Required to enable; feature disabled if absent |
| `LLM_BASE_URL` | `https://api.openai.com/v1` | Override for compatible providers |
| `LLM_MODEL` | `gpt-4o` | Model to use |

#### Behavior

`suggestLessons({ subjectName, curriculumName, existingTitles, count })`:

- Sends subject, curriculum name, existing titles, and requested count to the LLM
- System prompt instructs: return only a JSON array of strings
- Parses response, strips markdown fences, validates as string array
- Returns `{ suggestions: string[] }` or `{ error: string }`

#### Future Scope

- **AI-generated descriptions** — Suggest lesson descriptions and learning objectives, not just titles
- **Curriculum planning assistant** — Given a subject and grade level, generate an entire curriculum outline
- **Resource suggestions** — Recommend books, videos, or links for a given lesson topic

### Integration 3: Cron — Bump Overdue Lessons

#### Summary

A daily cron endpoint that finds lessons with past planned dates and reschedules them to today or the next valid school day. Prevents lessons from silently accumulating in the past.

#### Configuration

| Env Var | Description |
|---|---|
| `CRON_SECRET` | Required — shared secret for authentication |

#### Endpoint

`POST /api/cron/bump-lessons` (also accepts GET for cron services that require it)

- Auth via `x-cron-secret` header or `Authorization: Bearer` — compared with `timingSafeEqual`
- Iterates all children, bumps overdue lessons per-child respecting school day configuration and date overrides
- Returns `{ success: true, bumped: N }`

#### Behavior

For each child, finds all planned/in-progress lessons with `planned_date` in the past and reassigns them to the next available school days in order, using the same scheduling logic as `autoScheduleLessons` (respects custom weekdays, school days, and date overrides).
