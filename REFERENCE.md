# Harmony Homeschool - Technical Reference

**Note:** This file contains detailed reference material for humans. AI agents should refer to `CLAUDE.md` instead for token-efficient patterns.

## Tech Stack (Detailed)

- **Framework:** Next.js 14 (App Router) with TypeScript
- **Styling:** Tailwind CSS only (no component library, CSS-only charts)
- **Database:** PostgreSQL 16, accessed via `pg` driver with direct SQL (no ORM)
- **Auth:** NextAuth with JWT sessions and credentials provider (auth currently bypassed — landing page redirects straight to `/dashboard`)
- **Validation:** Zod for all server action inputs
- **AI:** LLM abstraction (`lib/llm.ts`) supporting OpenAI, Claude, and OpenAI-compatible endpoints
- **MCP:** Standalone MCP server (`mcp/homeschool-server.ts`) for Claude Code integration — stores data in local JSON, independent of PostgreSQL
- **Deployment:** Docker (multi-stage build, standalone output), Caddy reverse proxy

## Directory Structure (Full)

```
app/                        # Next.js App Router pages
  api/                      # API routes (auth, calendar, curricula, lessons, subjects)
  calendar/                 # Calendar view with lesson modals
  dashboard/                # Stats overview + recent activity
  grades/                   # Grade summaries and tables
  lessons/                  # Kanban board + lesson detail ([id]/)
  reports/                  # Progress reports with CSS bar charts
  students/                 # Student list + detail pages ([id]/)
  week/                     # Weekly planner (3-level drill-down: week → day → subject)
components/
  ui/                       # Reusable primitives: Badge, Card, EmptyState, Modal, PageHeader, ProgressBar, Sidebar, StatCard
  week/                     # Week planner components: Breadcrumbs, ChildSelector, DayColumn, LessonCard, LessonCheckbox, etc.
db/
  schema.sql                # Full PostgreSQL schema
  migrations/               # SQL migrations (001_add_grades.sql)
  seed.ts                   # Seed script: 3 children, 5 subjects each, 150 lessons
docs/                       # PLAN.md, ARCHITECTURE.md, TASKS.md
lib/
  actions/                  # Server actions (mutations)
    completions.ts          # markLessonComplete, updateGrade
    lessons.ts              # createLesson, updateLesson, deleteLesson, rescheduleLesson, bumpOverdueLessons, createSubject, createCurriculum
    students.ts             # Student management
  queries/                  # Read-only query functions
    calendar.ts             # Calendar data
    dashboard.ts            # getDashboardStats, getRecentActivity
    grades.ts               # Grade queries and summaries
    lessons.ts              # Lesson queries with joins
    reports.ts              # Progress report aggregations
    students.ts             # Student queries and progress
    week.ts                 # Week planner queries
  utils/
    dates.ts                # Date math helpers (week bounds, school days)
  auth.ts                   # NextAuth config (JWT, credentials provider)
  db.ts                     # pg Pool export
  llm.ts                    # LLM abstraction (openai/claude/openai_compatible)
mcp/
  homeschool-server.ts      # Standalone MCP server for Claude Code (JSON file storage)
prompts/                    # AI import prompt profiles (empty, to be built)
```

## Database Schema (Detailed)

Core hierarchy: **children → subjects → curricula → lessons → lesson_completions**

### Tables

- `users` — parent/kid accounts (role enum)
- `children` — student records
- `school_years` — academic year date ranges
- `school_days` / `date_overrides` — weekday schedule and holiday exceptions
- `subjects` — GLOBAL (no child_id, shared across children)
- `curricula` — units within a subject, assigned to children via curriculum_assignments
- `curriculum_assignments` — junction table (curriculum_id, child_id)
- `lessons` — individual assignments (status: planned | in_progress | completed), belong to curriculum
- `lesson_resources` — junction table linking lessons to resources
- `resources` — global library (books, videos, PDFs, links, supplies)
- `lesson_completions` — tracking with grade (NUMERIC 5,2) and notes
- `books` — reading tracker
- `import_batches` / `import_items` — AI import pipeline

### Key Relationships

- Subjects are global (one "Math", one "Science")
- Curricula belong to subjects and are assigned to specific children
- Lessons inherit child assignments from their curriculum
- Resources can be attached to multiple lessons

All primary keys are UUID (via pgcrypto). All foreign keys are indexed.

## Running the App

### Docker (Production)
```bash
# Start services
docker compose up --build

# Seed the database (DB is internal to Docker, not exposed to host)
docker exec -it harmony-homeschool-app-1 npx tsx db/seed.ts
```

### Development
```bash
npm run dev          # Next.js dev server (needs DATABASE_URL pointing to a running PG)
npm run db:seed      # Seed database
npm run db:migrate   # Run migrations
npm run build        # Production build
npm run lint         # ESLint
```

## Environment Variables

See `.env.example`. Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `POSTGRES_PASSWORD` — Used by docker-compose for the DB service
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — NextAuth config
- `LLM_PROVIDER` — `openai` | `claude` | `openai_compatible`
- `LLM_API_KEY` / `LLM_BASE_URL` — LLM credentials
- `FILERUN_BASE_URL` — Self-hosted file storage URL

## Dependencies

| Package | Purpose |
|---------|---------|
| `next` | App framework (App Router, server components, server actions) |
| `react` / `react-dom` | UI library |
| `pg` | PostgreSQL client (direct SQL, no ORM) |
| `next-auth` | Authentication (JWT sessions, credentials provider) |
| `zod` | Schema validation for server action inputs |
| `@neondatabase/serverless` | Neon DB serverless driver support |
| `@modelcontextprotocol/sdk` | MCP server SDK for Claude Code integration |
| `tsx` (dev) | TypeScript execution for seed script and MCP server |
| `tailwindcss` (dev) | Utility-first CSS framework |
| `typescript` (dev) | Type checking |
| `eslint` / `eslint-config-next` (dev) | Linting |
| `@tanstack/react-table` | Headless table library for editable lesson tables |

## Common Tasks (File Mapping)

| Task | Files to modify |
|------|----------------|
| Add a new page | `app/<route>/page.tsx`, add query in `lib/queries/<domain>.ts` |
| Add a mutation | `lib/actions/<domain>.ts` (server action with Zod), call `revalidatePath` |
| Add a query | `lib/queries/<domain>.ts`, import `pool` from `@/lib/db` |
| Add a UI component | `components/ui/<Name>.tsx` (stateless, Tailwind only) |
| Change DB schema | `db/schema.sql` + new file in `db/migrations/` |
| Add an API route | `app/api/<route>/route.ts` |
| Modify sidebar nav | `components/ui/Sidebar.tsx` |
| Add a new MCP tool | `mcp/homeschool-server.ts` |
| Add/manage resources | `app/resources/`, `lib/queries/resources.ts`, `lib/actions/resources.ts` |
| Create editable table | Use `@tanstack/react-table`, client component with inline editing |

## Related Documentation

- `CLAUDE.md` — Core patterns and token-efficient guidance for AI
- `AGENTS.md` — Claude Code workflow rules
- `BD.md` — Beads issue tracking workflow
- `.cursorrules` — AI coding rules (auto-loaded by AI tools)
- `TODO.md` — Feature backlog and known issues
- `DEPLOYMENT.md` — Deployment procedures and operations guide
- `docs/PLAN.md` — Original project planning documents
- `docs/ARCHITECTURE.md` — Deep architectural decisions
- `docs/TASKS.md` — Task breakdowns and implementation details

## Conventions (Full List)

- **Styling:** Tailwind utility classes only. Extended color palette: `primary-*` (indigo), `success-*` (emerald), `warning-*` (amber).
- **Imports:** Use `@/` path alias (maps to project root).
- **SQL:** Always use parameterized queries (`$1`, `$2`, ...). Never interpolate user input into SQL strings.
- **Actions:** Always validate with Zod before database operations. Return `{ success }` or `{ error }` objects.
- **Pages:** Always add `export const dynamic = "force-dynamic"` when the page queries the database.
- **Components:** UI primitives are stateless with inline prop types. Domain-specific components go in their own subdirectory under `components/`.
- **No chart library:** Visualizations use CSS (Tailwind widths/heights for bar charts).
- **No component library:** All UI built from scratch with Tailwind.

## Active Constraints

- **Auth is currently bypassed** — landing page redirects directly to `/dashboard` (no login required)
- **Docker builds must work without DB** — all database-querying pages need `export const dynamic = "force-dynamic"`
- **MCP server uses JSON storage** — completely separate from PostgreSQL, stores data in local JSON files
- **No external dependencies for UI** — everything built with Tailwind CSS, no shadcn/ui or other component libraries
- **Direct SQL only** — no ORM, all queries written by hand with parameterized inputs

## Current Sprint Focus

Check beads for current priorities:
```bash
bd ready    # Show unblocked issues
bd list     # Show all issues
```

Common sprints:
- [ ] Set up auth (parent/kid roles)
- [ ] Implement school-day calendar config
- [ ] Add PDF export for reports
- [ ] Wire AI provider abstraction
