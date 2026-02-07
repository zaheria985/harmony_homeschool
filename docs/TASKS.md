# Tasks

## Phase 1 — Foundation (Week 1)

### 1.1 Authentication — NextAuth Setup

```
Task: Configure NextAuth credentials provider with parent/kid roles
Scope: lib/auth.ts, app/api/auth/[...nextauth]/route.ts
Constraints:
- NextAuth v4 with JWT strategy
- Include role (parent|kid) and userId in JWT token and session
- Credentials provider: email + password via bcrypt
- Parameterized SQL queries only (no ORM)
- Use existing lib/db.ts pool
Output: TypeScript code only
Stop: After writing auth config, wait before building pages
```

### 1.2 Authentication — Register & Login Pages

```
Task: Build login and register pages with Server Actions
Scope: app/(auth)/login/page.tsx, app/(auth)/register/page.tsx, lib/actions/auth.ts
Constraints:
- Server Actions for form submission (no API routes)
- Zod validation on email, password (min 8 chars), role
- bcrypt hash on register, bcrypt compare on login
- Redirect to /dashboard on success
- Tailwind styling, no component library
- Max 80 lines per file
Output: TypeScript code only
Stop: After writing both pages + action file, wait for testing
```

### 1.3 Authentication — Middleware & Session Provider

```
Task: Protect routes with middleware, wrap app in session provider
Scope: middleware.ts, components/SessionProvider.tsx, app/layout.tsx
Constraints:
- Middleware protects /dashboard/*, /today/*, /import/*
- Redirect unauthenticated users to /login
- SessionProvider is a "use client" wrapper around NextAuth SessionProvider
- Update root layout to include SessionProvider
Output: TypeScript code only
Stop: After writing all three files, wait for auth testing confirmation
```

### 1.4 Lesson CRUD — Server Actions

```
Task: Create Server Actions for lesson create/read/update/delete
Scope: lib/actions/lessons.ts
Constraints:
- Zod schemas for input validation
- Auth check: getServerSession, reject if not parent role
- Parameterized SQL via lib/db.ts pool
- createLesson: insert into lessons, return new row
- updateLesson: update title, description, order_index, planned_date, status
- deleteLesson: delete by id, verify ownership via join to curricula→subjects
- getLessons: by curriculum_id, ordered by order_index
- revalidatePath after mutations
Output: TypeScript code only, JSDoc on exported functions
Stop: After writing actions file, wait before building UI
```

### 1.5 Lesson CRUD — Form & List Components

```
Task: Build lesson create/edit form and list view components
Scope: components/lessons/LessonForm.tsx, components/lessons/LessonList.tsx
Constraints:
- LessonForm: "use client", controlled form, calls Server Action
- Fields: title (required), description (textarea), planned_date (date input), status (select)
- LessonList: server component, renders lessons with status badges
- Status badges: planned=gray, in_progress=blue, completed=green
- Tailwind only, no component library
- Max 100 lines per component
Output: TypeScript/TSX code only
Stop: After writing both components, wait before wiring into pages
```

### 1.6 Lesson CRUD — Pages

```
Task: Create lesson list and edit pages within curriculum context
Scope: app/dashboard/subjects/[subjectId]/curricula/[curriculumId]/page.tsx,
       app/dashboard/subjects/[subjectId]/curricula/[curriculumId]/lessons/new/page.tsx,
       app/dashboard/subjects/[subjectId]/curricula/[curriculumId]/lessons/[lessonId]/edit/page.tsx
Constraints:
- Server components that fetch data and render LessonList/LessonForm
- Breadcrumb: Subject > Curriculum > Lessons
- "Add Lesson" button links to /new page
- Edit page pre-fills form with existing lesson data
- 404 handling if curriculum/lesson not found (notFound())
Output: TypeScript/TSX code only
Stop: After writing all three pages, wait for testing confirmation
```

### 1.7 Subject & Curriculum — Server Actions

```
Task: Create Server Actions for subject and curriculum CRUD
Scope: lib/actions/subjects.ts, lib/actions/curricula.ts
Constraints:
- Auth check: parent role only
- subjects: CRUD scoped to child_id + school_year_id
- curricula: CRUD scoped to subject_id, ordered by order_index
- updateCurriculumOrder: accept array of {id, order_index} for reordering
- Zod validation on all inputs
- Parameterized SQL only
Output: TypeScript code only
Stop: After writing both action files, wait before building UI
```

### 1.8 Subject & Curriculum — Pages

```
Task: Build subject list and curriculum management pages
Scope: app/dashboard/subjects/page.tsx,
       app/dashboard/subjects/[subjectId]/page.tsx,
       components/subjects/SubjectCard.tsx,
       components/curricula/CurriculumList.tsx
Constraints:
- Subject list: grid of cards showing name + color dot + curriculum count
- Subject detail: list of curricula with order handles (visual only, no drag yet)
- Filter by child and school year (query params)
- Create/edit inline or modal (prefer inline for simplicity)
- Tailwind only, max 80 lines per component
Output: TypeScript/TSX code only
Stop: After writing pages + components, wait for testing
```

### 1.9 Lesson Board View

```
Task: Build Kanban-style lesson board with three status columns
Scope: app/dashboard/board/page.tsx, components/board/BoardColumn.tsx,
       components/board/LessonCard.tsx, components/board/BoardFilters.tsx
Constraints:
- Three columns: Planned | In Progress | Completed
- LessonCard shows: title, subject name + color dot, planned_date
- Click card to advance status (planned→in_progress→completed)
- Status change calls updateLesson Server Action
- BoardFilters: child selector, school year selector, subject filter (dropdowns)
- Query lessons with subject + curriculum joins for display
- Tailwind only, responsive (stack columns on mobile)
- Max 120 lines for page, 60 lines per component
Output: TypeScript/TSX code only
Stop: After writing all board files, wait for testing confirmation
```

## Phase 2 — Core Features (Week 2)

### 2.1 Kid Today View

```
Task: Build mobile-optimized "today" page for kid users
Scope: app/today/page.tsx, components/today/TodayCard.tsx, lib/queries/today.ts
Constraints:
- Auth: kid role only (redirect parents to /dashboard)
- Query: lessons where planned_date = today, joined through
  curricula→subjects→children, filtered by child linked to this kid user
- TodayCard: large tap target, subject color bar, title, description preview
- "Mark Done" button calls markLessonComplete action
- Empty state: "Nothing planned for today" message
- Mobile-first: single column, min-h-[44px] touch targets
- Max 60 lines per component
Output: TypeScript/TSX code only
Stop: After writing all today-view files, wait for testing
```

### 2.2 Lesson Completion Tracking

```
Task: Server Action and UI for marking lessons complete/incomplete
Scope: lib/actions/completions.ts, components/lessons/CompletionBadge.tsx
Constraints:
- markLessonComplete: insert into lesson_completions, update lesson status to 'completed'
- undoLessonCompletion: delete from lesson_completions, reset lesson status to 'in_progress'
- Auth: parent or kid whose child_id matches
- CompletionBadge: shows checkmark + "Completed by [name] on [date]"
- Both operations in a SQL transaction (BEGIN/COMMIT)
- revalidatePath after mutation
Output: TypeScript code only
Stop: After writing action + component, wait for integration testing
```

### 2.3 YouTube Thumbnail Preview

```
Task: YouTube video ID extractor and thumbnail component
Scope: lib/youtube.ts, components/resources/YouTubeThumbnail.tsx
Constraints:
- Extract video ID from: youtube.com/watch?v=, youtu.be/, youtube.com/embed/
- Return null for non-YouTube URLs
- Thumbnail URL: https://img.youtube.com/vi/{id}/mqdefault.jpg
- Component: img with fallback, wrapped in link to video
- Pure functions, no API calls
- Max 30 lines for utility, 25 lines for component
Output: TypeScript code only
Stop: After writing both files, wait before integrating into lesson cards
```

### 2.4 FileRun Link Integration

```
Task: FileRun URL builder and resource link component
Scope: lib/filerun.ts, components/resources/FileRunLink.tsx
Constraints:
- buildFileRunUrl: combine FILERUN_BASE_URL env + resource path
- FileRunLink: "Open in FileRun" button with external link icon
- Handle missing FILERUN_BASE_URL gracefully (hide link)
- Max 20 lines for utility, 25 lines for component
Output: TypeScript code only
Stop: After writing both files, wait before integrating
```

## Phase 3 — AI Import (Week 3)

### 3.1 LLM Adapter Interface

```
Task: Refactor lib/llm.ts into pluggable provider interface
Scope: lib/llm.ts, lib/llm/types.ts, lib/llm/openai.ts, lib/llm/claude.ts,
       lib/llm/openai-compatible.ts
Constraints:
- LLMProvider interface: chatCompletion(messages, options) → {content: string}
- Options: model override, max_tokens, temperature, response_format (for JSON mode)
- Each adapter in its own file, implements LLMProvider
- Factory function: getLLMProvider() reads LLM_PROVIDER env, returns adapter
- Claude adapter uses Anthropic messages API (x-api-key header)
- OpenAI-compatible uses LLM_BASE_URL
- No external SDK dependencies — raw fetch only
- Max 60 lines per adapter
Output: TypeScript code only
Stop: After writing all LLM files, wait for testing with real API key
```

### 3.2 PDF Upload Endpoint

```
Task: API route to accept PDF upload and create import batch
Scope: app/api/import/upload/route.ts, lib/pdf.ts
Constraints:
- POST handler: accept multipart/form-data with file + prompt_profile field
- Extract text from PDF (use pdf-parse package)
- Create import_batches row (user_id, filename, prompt_profile, status='pending')
- Return {batchId, pageCount, textLength}
- Auth: parent role only
- Max file size: 10MB (check Content-Length)
- Max 50 lines for route, 30 lines for pdf utility
Output: TypeScript code only
Stop: After writing route + utility, wait for upload testing
```

### 3.3 AI Parsing with Structured Output

```
Task: Send extracted PDF text to LLM, parse into import_items
Scope: app/api/import/[batchId]/parse/route.ts, prompts/lesson-extract.md,
       prompts/book-extract.md, lib/actions/import.ts
Constraints:
- POST /api/import/[batchId]/parse triggers parsing
- Load prompt profile from /prompts/{profile}.md
- Send to LLM with JSON mode enabled
- Parse response into import_items rows (item_type, extracted_json, source_page, confidence)
- Prompt templates use {{text}} placeholder for PDF content
- Zod schema to validate LLM JSON output structure
- Update batch status to 'reviewed' after parsing
Output: TypeScript code + markdown prompt templates
Stop: After writing all parse files, wait for end-to-end test
```

### 3.4 Review Queue UI

```
Task: Build import item review page with approve/reject/edit controls
Scope: app/import/[batchId]/review/page.tsx,
       components/import/ImportItemRow.tsx,
       components/import/ReviewActions.tsx
Constraints:
- Server component page fetches batch + items
- Table columns: item_type, extracted title, confidence %, source page, status, actions
- Confidence badge: green ≥0.8, yellow ≥0.5, red <0.5
- Actions: approve, reject, edit (inline edit of extracted_json)
- Bulk select + bulk approve/reject toolbar
- Server Actions for updateImportItem, bulkUpdateImportItems
- Max 100 lines for page, 60 lines per component
Output: TypeScript/TSX code only
Stop: After writing review UI files, wait for testing
```

### 3.5 Approval & Commit Workflow

```
Task: Commit approved import items as real lessons/books
Scope: lib/actions/import-commit.ts, app/import/[batchId]/commit/page.tsx
Constraints:
- commitBatch action: wrap in SQL transaction
- For item_type='lesson': insert into lessons table, create lesson_resources if URLs in extracted_json
- For item_type='book': insert into books table
- Skip rejected items, error on 'pending' items (must review all first)
- Update batch status to 'committed'
- Commit page shows summary: X lessons created, Y books created, Z skipped
- Return to /import after commit
- Max 80 lines for action, 60 lines for page
Output: TypeScript code only
Stop: After writing commit files, wait for full pipeline test
```

## Phase 4 — Advanced (Week 4+)

### 4.1 School Day Scheduler

```
Task: Calendar settings page with weekday toggles and date overrides
Scope: app/dashboard/settings/calendar/page.tsx,
       components/calendar/WeekdayGrid.tsx,
       components/calendar/DateOverrideForm.tsx,
       lib/actions/calendar.ts
Constraints:
- WeekdayGrid: 7 toggle buttons (Sun–Sat), saves to school_days table
- DateOverrideForm: date picker + type (exclude/include) + reason text
- Server Actions: setSchoolDays, addDateOverride, removeDateOverride
- Scoped to selected school_year_id
- Show count of total school days after calculation
- Max 60 lines per component
Output: TypeScript/TSX code only
Stop: After writing calendar files, wait for testing
```

### 4.2 Auto-Shifting Lesson Dates

```
Task: Redistribute lesson planned_dates when calendar changes
Scope: lib/scheduler.ts, lib/actions/calendar.ts (extend)
Constraints:
- getSchoolDays(schoolYearId): returns sorted Date[] of valid school days
- shiftLessonDates(subjectId): reassign planned_dates to lessons in order_index order
  across valid school days
- Trigger after school_days or date_overrides change
- Preview mode: return proposed changes without applying
- Apply mode: batch UPDATE in transaction
- Pure date math, no date libraries
- Max 80 lines
Output: TypeScript code only
Stop: After writing scheduler, wait for testing with sample data
```

### 4.3 Book Tracker

```
Task: Book management with Google Books API search
Scope: app/dashboard/books/page.tsx, app/api/books/search/route.ts,
       components/books/BookCard.tsx, components/books/BookSearchForm.tsx,
       lib/actions/books.ts
Constraints:
- Google Books API: GET https://www.googleapis.com/books/v1/volumes?q={query}
- No API key required for basic search
- BookSearchForm: search by title or ISBN, show results, click to add
- Auto-fill: title, author, isbn, cover_url from API response
- BookCard: cover image, title, author, status badge, progress actions
- Server Actions: addBook, updateBookStatus, deleteBook
- Filter by child + school_year + status
- Max 80 lines per component
Output: TypeScript/TSX code only
Stop: After writing all book files, wait for testing
```

### 4.4 PDF Report Generation

```
Task: Generate downloadable PDF reports for compliance
Scope: app/api/reports/[type]/route.ts, lib/reports/attendance.ts,
       lib/reports/completion.ts, lib/reports/portfolio.ts
Constraints:
- Three report types: attendance, completion, portfolio
- GET /api/reports/attendance?schoolYearId=&childId= → PDF
- Use @react-pdf/renderer for server-side PDF generation
- Attendance: table of school days with present/absent
- Completion: lessons grouped by subject with completion dates
- Portfolio: narrative descriptions of completed lessons
- Return Content-Type: application/pdf with Content-Disposition: attachment
- Max 100 lines per report generator
Output: TypeScript code only
Stop: After writing report route + generators, wait for output review
```

### 4.5 Gantt-Style Planning View

```
Task: Timeline visualization of curricula and lessons across school year
Scope: app/dashboard/planner/page.tsx, components/planner/GanttChart.tsx,
       components/planner/GanttBar.tsx, components/planner/GanttTimeline.tsx
Constraints:
- "use client" components (requires interaction)
- Horizontal timeline: months across top, subjects as rows
- GanttBar: colored bar per curriculum spanning its lesson date range
- Lessons rendered as segments within bar
- Click lesson segment to edit planned_date
- Drag bar edges to reschedule (update via Server Action)
- Zoom: week/month/semester toggles change column width
- CSS Grid layout, no chart libraries
- Responsive: horizontal scroll on mobile
- Max 120 lines for GanttChart, 50 lines per sub-component
Output: TypeScript/TSX code only
Stop: After writing all planner files, wait for visual review
```
