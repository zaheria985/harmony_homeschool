# Architecture

Next.js 14 (App Router) + TypeScript + Tailwind on PostgreSQL, deployed as a
Docker Compose stack. No ORM, no UI library, no external services required to
run it.

## Directory Structure

```
harmony_homeschool/
├── app/                    # Next.js App Router — one directory per route
│   ├── layout.tsx          # Root layout (sidebar, theme)
│   ├── page.tsx            # Entry — redirects to /dashboard
│   ├── dashboard/          # Home: stats, this week, what's due
│   ├── week/               # Week planner (drag-and-drop board)
│   ├── calendar/           # Month/semester calendar
│   ├── lessons/            # Lesson list, detail, editable table
│   ├── curricula/          # Courses
│   ├── subjects/           # Subjects (global, shared across children)
│   ├── students/           # Per-student progress
│   ├── grades/             # Gradebook
│   ├── reports/            # Progress reports, attendance, transcripts
│   ├── completed/          # Completed-work report (printable)
│   ├── approvals/          # Parent queue for kid-submitted completions
│   ├── reading/            # Reading log (kids may write their own)
│   ├── resources/          # Resource library
│   ├── booklists/          # Booklists
│   ├── prep/               # Weekly prep — upcoming books/supplies
│   ├── tags/               # Tag management
│   ├── admin/              # School calendar, imports, audit log, users
│   ├── settings/           # Grading scales, account
│   ├── login/, signup/     # Auth pages
│   └── api/                # Route handlers (see below)
├── components/             # React components, grouped by domain
│   └── ui/                 # Reusable primitives (Card, Modal, StatCard, …)
├── lib/
│   ├── actions/            # Server actions (mutations), by domain
│   ├── queries/            # Read-only queries, by domain
│   ├── server/             # Server-only helpers (authz, audit, uploads,
│   │                       #   lesson-bump, daily-digest, signup-policy)
│   ├── utils/              # Pure helpers (dates, timezone, streaks, …)
│   ├── db.ts               # pg.Pool
│   ├── auth.ts             # NextAuth configuration
│   └── llm.ts              # Optional LLM provider abstraction
├── db/
│   ├── schema.sql          # Fresh-install schema
│   ├── migrations/         # Numbered, applied in order by db/migrate.js
│   ├── bootstrap.js        # Applies schema.sql when the DB is empty
│   └── seed.ts             # Optional demo data
├── tests/                  # node:test suites (no DB required)
├── scripts/                # backup.sh and other sidecar scripts
├── docs/plans/             # Feature spec and planning documents
└── docker-compose.yml      # db, app, cron, backup
```

## API routes

Most reads happen in server components and most writes in server actions, so
`app/api/` is deliberately small: NextAuth (`/api/auth`), the calendar data feed
and iCal export, cron endpoints (`/api/cron/*`), report exports, search,
uploads, and a few pickers used by client components.

## Key Design Decisions

### Database access

Direct PostgreSQL via the `pg` driver — queries are explicit and the dependency
surface stays small. `lib/db.ts` owns the single pool.

Date columns are cast to text in SQL (`planned_date::text`). node-postgres would
otherwise hand client components a `Date` where they expect a `YYYY-MM-DD`
string; `tests/query-date-shape.test.ts` enforces this.

### Authentication and authorization

NextAuth with the credentials provider and a JWT session — no database adapter
and no OAuth providers. Passwords are bcrypt hashes in the `users` table.

Authorization has two layers, because they cover different things:

- `middleware.ts` gates *page* navigation and sends kids back to the pages
  they are allowed on.
- `lib/server/authz.ts` gates *server actions*. Actions are POST endpoints that
  middleware never sees, so every exported action starts with `requireParent()`
  or `requireUser()`. Sessions fail closed: a token missing `id`/`role` is
  unauthenticated, and an unrecognized permission level degrades to `view_only`.

Kid-callable actions (completing a lesson, logging reading) resolve the child
with `scopedChildId()` and ignore any caller-supplied child id.

### Server actions

Form submissions and mutations go through Next.js server actions: Zod validate →
parameterized query → `revalidatePath()` → return `{success}` or `{error}`. No
separate REST or GraphQL layer for CRUD.

### Time

Server-side "today" comes from `todayKey()` (`lib/utils/timezone.ts`), which
honors `APP_TIMEZONE` — never `new Date()` date-math and never SQL
`CURRENT_DATE`, both of which use the container's zone. Client components keep
using browser-local time, which is already the family's zone.

Scheduled-job hours (`BUMP_HOUR`, `DIGEST_HOUR`, `BACKUP_HOUR`) are UTC — the
sidecar shells only have reliable UTC.

### School years

Year-scoped statistics resolve their year through `resolveActiveSchoolYear()`
(`lib/queries/school-year.ts`): the year containing today, else the most
recently started one, else the next upcoming one. Families school year-round, so
"today is inside a configured school year" cannot be assumed — scheduling
outside a year is always allowed, it just does not count toward that year's
totals until a year covers it.

### File storage

Uploads are written to a local directory (`UPLOADS_DIR`, a Docker volume in the
default stack) by `lib/server/uploads.ts` and served back through
`app/api/uploads/[...path]`. SVG and unknown types are forced to download rather
than rendered inline.

### LLM abstraction

`lib/llm.ts` abstracts over providers, selected by `LLM_PROVIDER`. Everything
LLM-backed is optional and degrades to "AI is not configured" when `LLM_API_KEY`
is unset.

## Request Flow

```
Browser ──> App Router ──> Server Component (lib/queries/*)
        └─> Server Action (lib/actions/*) ──> lib/server/authz.ts guard
                                          └─> lib/db.ts (pg.Pool) ──> PostgreSQL
```

## Background jobs

The `cron` sidecar calls secret-authenticated endpoints inside the app
container: `/api/cron/bump-lessons` moves overdue incomplete lessons forward,
and `/api/cron/daily-digest` posts a summary to `HA_WEBHOOK_URL`. Both require
`CRON_SECRET`. When `CRON_SECRET` is unset, `lazyBumpIfNoScheduler()` runs the
bump at most once a day on dashboard render as a fallback.

The `backup` sidecar runs `pg_dump` daily (`scripts/backup.sh`, 14-day
retention).

## Security

- Every query is parameterized; no string interpolation into SQL.
- Every server action carries its own authorization guard.
- Public signup is off unless `SIGNUP_ENABLED=true` or the `users` table is
  empty (first-run bootstrap); an optional `SIGNUP_INVITE_CODE` gates it further.
- The iCal feed fails closed — no `CALENDAR_ICAL_TOKEN`, no feed.
- Approvals and account changes are written to `audit_log` via `recordAudit()`.
- Environment secrets are never exposed to the client bundle.
