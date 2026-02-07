# Harmony - Homeschool Tracking Platform

## Vision

Harmony is a web application for homeschool families to plan curricula, track
daily lessons, manage reading lists, and generate compliance reports. Parents
create subjects and curricula per child per school year, then schedule lessons
across the calendar. Kids see a focused "today view" of their assignments.
An AI import pipeline lets parents upload publisher PDFs and have an LLM
extract structured lesson and book data for review before committing.

## Tech Stack

| Layer          | Technology                |
|----------------|---------------------------|
| Framework      | Next.js 14 (App Router)   |
| Language       | TypeScript                |
| Database       | PostgreSQL 16 (pg driver) |
| Auth           | NextAuth.js (JWT)         |
| Styling        | Tailwind CSS              |
| File Storage   | FileRun (self-hosted)     |
| AI Integration | OpenAI / Claude / Custom  |

## Data Model

- **users** — parent and kid accounts (role-based)
- **children** — students being homeschooled
- **school_years** — date-bounded academic years
- **school_days** / **date_overrides** — calendar configuration
- **subjects** — per child per school year
- **curricula** — ordered units within a subject
- **lessons** — individual assignments within a curriculum
- **lesson_resources** — links (YouTube, PDF, FileRun, URL)
- **lesson_completions** — who completed what and when
- **books** — reading tracker per child per year
- **import_batches** / **import_items** — AI import pipeline

## Phased Roadmap

### Phase 1 — Foundation (Week 1)
1. **Authentication system** — NextAuth credentials provider with parent/kid
   roles, JWT sessions, login/register pages, middleware-protected routes
2. **Basic lesson CRUD** — create, read, update, delete lessons within
   curricula; Server Actions for mutations
3. **Subject & curriculum management** — nested CRUD: school year → subject →
   curriculum with drag-to-reorder
4. **Simple lesson board view** — Kanban-style columns (planned / in progress /
   completed) per subject, filterable by child and school year

### Phase 2 — Core Features (Week 2)
1. **Kid "today view"** — mobile-optimized page showing today's lessons for the
   logged-in kid, with swipe-to-complete gestures
2. **Lesson completion tracking** — mark lessons done, record who completed and
   when, update lesson status automatically
3. **YouTube thumbnail preview** — extract video ID from URLs, display
   thumbnails inline on lesson cards
4. **FileRun link integration** — deep-link to FileRun-hosted PDFs and
   documents from lesson resources

### Phase 3 — AI Import (Week 3)
1. **LLM adapter interface** — pluggable provider abstraction supporting
   OpenAI, Claude, and OpenAI-compatible endpoints via env config
2. **PDF upload endpoint** — accept PDF files, extract text, store batch
   metadata
3. **AI parsing with structured output** — send extracted text + prompt profile
   to LLM, parse JSON response into import_items
4. **Review queue UI** — table of extracted items with approve/reject/edit
   controls, confidence scores, source page references
5. **Approval & commit workflow** — batch-approve reviewed items, create
   lessons and books from committed import data

### Phase 4 — Advanced (Week 4+)
1. **School day scheduler** — configure which weekdays are school days per year,
   add date overrides for holidays/snow days/make-up days
2. **Auto-shifting lesson dates** — when calendar changes, automatically
   redistribute planned lesson dates across valid school days
3. **Book tracker** — Google Books API integration for cover art and metadata,
   reading status progression, per-child reading lists
4. **PDF report generation** — exportable attendance logs, lesson completion
   reports, and portfolio summaries for compliance
5. **Gantt-style planning view** — timeline visualization of curricula and
   lessons across the school year with drag-to-reschedule
